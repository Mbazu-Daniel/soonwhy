import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import {
  connect,
  NatsConnection,
  JetStreamClient,
  RetentionPolicy,
  AckPolicy,
  DeliverPolicy,
  JsMsg,
  StorageType,
} from "nats";

export type NatsMessageHandler = (msg: JsMsg) => Promise<void>;
export type NatsSubscriptionSnapshot = {
  subject: string;
  durable: string;
  active: boolean;
  processed: number;
  failed: number;
  lastError: string | undefined;
};

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsService.name);
  private connection: NatsConnection | undefined;
  private jetstream: JetStreamClient | undefined;
  private readonly subscriptions = new Map<string, NatsSubscriptionSnapshot>();
  private readonly config = {
    url: process.env.NATS_URL ?? "nats://localhost:4222",
    streamName: process.env.NATS_STREAM_NAME ?? "TELEMETRY",
    maxBytes: Number(process.env.NATS_MAX_BYTES ?? 1024 * 1024 * 1024),
    maxAgeNs: Number(
      process.env.NATS_MAX_AGE_NS ?? 24 * 60 * 60 * 1_000_000_000,
    ),
    maxAckPending: Number(process.env.NATS_MAX_ACK_PENDING ?? 1000),
  };

  async onModuleInit() {
    const maxAttempts = Number(process.env.NATS_CONNECT_ATTEMPTS ?? 10);
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.connection = await connect({
          servers: this.config.url,
          maxReconnectAttempts: -1,
          reconnectTimeWait: 2000,
        });
        this.jetstream = this.connection.jetstream();
        await this.ensureStream();
        this.attachLifecycleHandlers();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.connection = undefined;
        this.jetstream = undefined;
        if (attempt < maxAttempts)
          await this.sleep(Math.min(1000 * attempt, 5000));
      }
    }
    throw lastError ?? new Error("NATS connection failed");
  }

  async onModuleDestroy() {
    for (const state of this.subscriptions.values()) state.active = false;
    this.subscriptions.clear();
    if (this.connection) {
      await this.connection.drain();
      this.connection = undefined;
      this.jetstream = undefined;
    }
  }

  private async ensureStream() {
    const jsm = await this.connection!.jetstreamManager();
    try {
      const info = await jsm.streams.info(this.config.streamName);
      const subjects = info.config.subjects || [];
      if (
        !subjects.includes("ingest.>") ||
        info.config.max_bytes !== this.config.maxBytes ||
        info.config.max_age !== this.config.maxAgeNs
      ) {
        await jsm.streams.update(this.config.streamName, {
          ...info.config,
          subjects: [...new Set([...subjects, "ingest.>"])],
          max_bytes: this.config.maxBytes,
          max_age: this.config.maxAgeNs,
        });
      }
    } catch {
      await jsm.streams.add({
        name: this.config.streamName,
        subjects: ["ingest.>"],
        retention: RetentionPolicy.Limits,
        max_bytes: this.config.maxBytes,
        max_age: this.config.maxAgeNs,
        storage: StorageType.File,
      });
    }
  }

  private attachLifecycleHandlers() {
    if (!this.connection) return;
    this.connection
      .closed()
      .then(() => {
        this.connection = undefined;
        this.jetstream = undefined;
      })
      .catch(() => {});
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  get client(): JetStreamClient {
    if (!this.jetstream) throw new Error("NATS JetStream not connected");
    return this.jetstream;
  }
  get nc(): NatsConnection {
    if (!this.connection) throw new Error("NATS not connected");
    return this.connection;
  }
  isReady(): boolean {
    return this.connection !== undefined && this.jetstream !== undefined;
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
    options?: { durable?: string; maxDeliver?: number; maxAckPending?: number },
  ) {
    const js = this.client;
    const consumerName =
      options?.durable || `consumer-${subject.replace(/\./g, "-")}`;
    const maxDeliver = options?.maxDeliver ?? 6;
    const maxAckPending = options?.maxAckPending ?? this.config.maxAckPending;
    const subscriptionKey = `${consumerName}:${subject}`;
    this.subscriptions.set(subscriptionKey, {
      subject,
      durable: consumerName,
      active: false,
      processed: 0,
      failed: 0,
      lastError: undefined,
    });

    const jsm = await this.nc.jetstreamManager();
    try {
      const info = await jsm.consumers.info(
        this.config.streamName,
        consumerName,
      );
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

    const consumer = await js.consumers.get(
      this.config.streamName,
      consumerName,
    );
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
            state.lastError =
              error instanceof Error ? error.message : String(error);
            try {
              msg.nak();
            } catch {}
          }
        }
      } catch (error) {
        state.active = false;
        state.lastError =
          error instanceof Error ? error.message : String(error);
      }
    })();
    return messages;
  }
}
