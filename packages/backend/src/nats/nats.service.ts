import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { connect, NatsConnection, JetStreamClient, StreamConfig, RetentionPolicy } from 'nats';

export interface NatsConfig {
  url: string;
  streamName: string;
}

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsService.name);
  private connection: NatsConnection | null = null;
  private jetstream: JetStreamClient | null = null;

  private readonly config: NatsConfig = {
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
      await jsm.streams.info(this.config.streamName);
    } catch {
      const config: Partial<StreamConfig> = {
        name: this.config.streamName,
        subjects: ['ingest.>'],
        retention: RetentionPolicy.Limits,
        max_bytes: 1024 * 1024 * 1024, // 1GB
        max_age: 24 * 60 * 60 * 1_000_000_000, // 24h in nanoseconds
        storage: 'file' as any,
      };
      await jsm.streams.add(config);
      this.logger.log(`Stream "${this.config.streamName}" created`);
    }
  }

  get client(): JetStreamClient {
    if (!this.jetstream) {
      throw new Error('NATS JetStream not connected');
    }
    return this.jetstream;
  }

  get nc(): NatsConnection {
    if (!this.connection) {
      throw new Error('NATS not connected');
    }
    return this.connection;
  }

  async publish(subject: string, data: Uint8Array): Promise<void> {
    const js = this.client;
    await js.publish(subject, data);
  }

  async subscribe(
    subject: string,
    handler: (msg: any) => Promise<void>,
    options?: { durable?: string; deliverAll?: boolean },
  ) {
    const js = this.client;
    const consumerName = options?.durable || `consumer-${subject.replace(/\./g, '-')}`;

    const jsm = await this.nc.jetstreamManager();
    try {
      await jsm.consumers.info(this.config.streamName, consumerName);
    } catch {
      await jsm.consumers.add(this.config.streamName, {
        durable_name: consumerName,
        filter_subject: subject,
        deliver_policy: options?.deliverAll ? 'all' : 'new' as any,
        ack_policy: 'explicit' as any,
      });
    }

    const consumer = await js.consumers.get(this.config.streamName, consumerName);
    const messages = await consumer.consume();

    (async () => {
      for await (const msg of messages) {
        try {
          await handler(msg);
          msg.ack();
        } catch (error) {
          this.logger.error(`Error processing message on ${subject}`, error);
          msg.nak();
        }
      }
    })();

    return messages;
  }
}
