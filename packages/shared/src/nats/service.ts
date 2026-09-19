import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import {
  connect,
  NatsConnection,
  JetStreamClient,
  RetentionPolicy,
  AckPolicy,
  DeliverPolicy,
  JsMsg,
} from 'nats';

export type NatsMessageHandler = (msg: JsMsg) => Promise<void>;

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsService.name);
  private connection: NatsConnection | null = null;
  private jetstream: JetStreamClient | null = null;

  private readonly config = {
    url: process.env.NATS_URL || 'nats://localhost:4222',
    streamName: process.env.NATS_STREAM_NAME || 'TELEMETRY',
  };

  async onModuleInit() {
    try {
      this.connection = await connect({ servers: this.config.url });
      this.jetstream = this.connection.jetstream();
      await this.ensureStream();
      this.logger.log('NATS JetStream connected');
    } catch (error) {
      this.logger.error('Failed to connect to NATS', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.connection) {
      await this.connection.drain();
      this.logger.log('NATS connection drained');
    }
  }

  private async ensureStream() {
    const jsm = await this.connection!.jetstreamManager();
    try {
      const info = await jsm.streams.info(this.config.streamName);
      const subjects = info.config.subjects || [];
      if (!subjects.includes('ingest.>')) {
        await jsm.streams.update(this.config.streamName, {
          ...info.config,
          subjects: [...new Set([...subjects, 'ingest.>'])],
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/stream.*not found|stream not found/i.test(message)) {
        throw error;
      }

      await jsm.streams.add({
        name: this.config.streamName,
        subjects: ['ingest.>'],
        retention: RetentionPolicy.Limits,
        max_bytes: 1024 * 1024 * 1024,
        max_age: 24 * 60 * 60 * 1_000_000_000,
        storage: 'file' as any,
      });
      this.logger.log(`Stream "${this.config.streamName}" created`);
    }
  }

  get client(): JetStreamClient {
    if (!this.jetstream) throw new Error('NATS JetStream not connected');
    return this.jetstream;
  }

  get nc(): NatsConnection {
    if (!this.connection) throw new Error('NATS not connected');
    return this.connection;
  }

  async publish(subject: string, data: Uint8Array): Promise<void> {
    await this.client.publish(subject, data);
  }

  async subscribe(
    subject: string,
    handler: NatsMessageHandler,
    options?: {
      durable?: string;
      maxDeliver?: number;
    },
  ) {
    const js = this.client;
    const consumerName = options?.durable || `consumer-${subject.replace(/\./g, '-')}`;
    const maxDeliver = options?.maxDeliver ?? 6;

    const jsm = await this.nc.jetstreamManager();
    try {
      await jsm.consumers.info(this.config.streamName, consumerName);
    } catch {
      await jsm.consumers.add(this.config.streamName, {
        durable_name: consumerName,
        filter_subject: subject,
        deliver_policy: DeliverPolicy.New,
        ack_policy: AckPolicy.Explicit,
        max_deliver: maxDeliver,
        ack_wait: 30_000_000_000,
      });
    }

    const consumer = await js.consumers.get(this.config.streamName, consumerName);
    const messages = await consumer.consume();

    (async () => {
      for await (const msg of messages) {
        try {
          await handler(msg);
        } catch (error) {
          this.logger.error(`Unhandled error on ${subject}`, error);
          try {
            msg.nak();
          } catch {
            /* ignore */
          }
        }
      }
    })();

    return messages;
  }
}
