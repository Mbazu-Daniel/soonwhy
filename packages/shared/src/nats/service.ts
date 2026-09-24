import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import {
  connect,
  NatsConnection,
  JetStreamClient,
  RetentionPolicy,
  AckPolicy,
  DeliverPolicy,
  JsMsg,
  StorageType,
} from 'nats';

export type NatsMessageHandler = (msg: JsMsg) => Promise<void>;

export type NatsSubscriptionSnapshot = {
  subject: string;
  durable: string;
  active: boolean;
  processed: number;
  failed: number;
  lastError: string | null;
};

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsService.name);
  private connection: NatsConnection | null = null;
  private jetstream: JetStreamClient | null = null;
  private readonly subscriptions = new Map<string, NatsSubscriptionSnapshot>();

  private readonly config = {
    url: process.env.NATS_URL || 'nats://localhost:4222',
    streamName: process.env.NATS_STREAM_NAME || 'TELEMETRY',
    maxBytes: Number(process.env.NATS_MAX_BYTES || 1024 * 1024 * 1024),
    maxAgeNs: Number(process.env.NATS_MAX_AGE_NS || 24 * 60 * 60 * 1_000_000_000),
    maxAckPending: Number(process.env.NATS_MAX_ACK_PENDING || 1000),
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
    for (const state of this.subscriptions.values()) state.active = false;
    this.subscriptions.clear();

    if (this.connection) {
      await this.connection.drain();
      this.connection = null;
      this.jetstream = null;
      this.logger.log('NATS connection drained');
    }
  }

  private async ensureStream() {
    const jsm = await this.connection!.jetstreamManager();
    try {
      const info = await jsm.streams.info(this.config.streamName);
      const subjects = info.config.subjects || [];
      if (
        !subjects.includes('ingest.>') ||
        info.config.max_bytes !== this.config.maxBytes ||
        info.config.max_age !== this.config.maxAgeNs
      ) {
        await jsm.streams.update(this.config.streamName, {
          ...info.config,
          subjects: [...new Set([...subjects, 'ingest.>'])],
          max_bytes: this.config.maxBytes,
          max_age: this.config.maxAgeNs,
        });
      }
    } catch {
      await jsm.streams.add({
        name: this.config.streamName,
        subjects: ['ingest.>'],
        retention: RetentionPolicy.Limits,
        max_bytes: this.config.maxBytes,
        max_age: this.config.maxAgeNs,
        storage: StorageType.File,
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

  isReady(): boolean {
    return this.connection !== null && this.jetstream !== null;
  }

  subscriptionSnapshot(): NatsSubscriptionSnapshot[] {
    return [...this.subscriptions.values()].map((state) => ({ ...state }));
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
      maxAckPending?: number;
    },
  ) {
    const js = this.client;
    const consumerName = options?.durable || `consumer-${subject.replace(/\./g, '-')}`;
    const maxDeliver = options?.maxDeliver ?? 6;
    const maxAckPending = options?.maxAckPending ?? this.config.maxAckPending;
    const subscriptionKey = `${consumerName}:${subject}`;
    this.subscriptions.set(subscriptionKey, {
      subject,
      durable: consumerName,
      active: false,
      processed: 0,
      failed: 0,
      lastError: null,
    });

    const jsm = await this.nc.jetstreamManager();
    try {
      const info = await jsm.consumers.info(this.config.streamName, consumerName);
      if (info.config.max_ack_pending !== maxAckPending) {
        await jsm.consumers.update(this.config.streamName, consumerName, {
          ...info.config,
          max_ack_pending: maxAckPending,
        });
      }
    } catch {
      await jsm.consumers.add(this.config.streamName, {
        durable_name: consumerName,
        filter_subject: subject,
        deliver_policy: DeliverPolicy.New,
        ack_policy: AckPolicy.Explicit,
        max_deliver: maxDeliver,
        ack_wait: 30_000_000_000,
        max_ack_pending: maxAckPending,
      });
    }

    const consumer = await js.consumers.get(this.config.streamName, consumerName);
    const messages = await consumer.consume();

    const state = this.subscriptions.get(subscriptionKey)!;
    state.active = true;

    (async () => {
      try {
        for await (const msg of messages) {
          try {
            await handler(msg);
            state.processed += 1;
          } catch (error) {
            state.failed += 1;
            state.lastError = error instanceof Error ? error.message : String(error);
            this.logger.error(`Unhandled error on ${subject}`, error);
            try {
              msg.nak();
            } catch {
              /* ignore */
            }
          }
        }
      } catch (error) {
        state.active = false;
        state.lastError = error instanceof Error ? error.message : String(error);
        this.logger.error(`NATS consumer stopped on ${subject}`, error);
      }
    })();

    return messages;
  }
}
