import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NatsService } from './nats.service';
import { ClickhouseService } from './clickhouse.service';

interface RawEvent {
  id: string;
  timestamp: number;
  type: string;
  projectId: string;
  service?: string;
  data: Record<string, unknown>;
}

@Injectable()
export class IngestionConsumer implements OnModuleInit {
  private readonly logger = new Logger(IngestionConsumer.name);
  private buffer: RawEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly nats: NatsService,
    private readonly clickhouse: ClickhouseService,
  ) {}

  async onModuleInit() {
    const types = ['log', 'metric', 'error', 'request', 'trace'];
    for (const type of types) {
      await this.nats.subscribe(`ingest.*.${type}`, async (msg) => {
        const event = JSON.parse(new TextDecoder().decode(msg.data)) as RawEvent;
        this.buffer.push(event);
        if (this.buffer.length >= 100) await this.flush();
      }, { durable: `consumer-${type}` });
    }
    this.flushTimer = setInterval(() => this.flush().catch(console.error), 5000);
    this.logger.log('Ingestion consumer started');
  }

  private async flush() {
    if (this.buffer.length === 0) return;
    const batch = [...this.buffer];
    this.buffer = [];

    const grouped: Record<string, RawEvent[]> = {};
    for (const event of batch) {
      (grouped[event.type] ??= []).push(event);
    }

    for (const [type, events] of Object.entries(grouped)) {
      try {
        await this.clickhouse.insert(type, events.map((e) => ({
          id: e.id,
          timestamp: new Date(e.timestamp || Date.now()).toISOString().replace('T', ' ').replace('Z', ''),
          project_id: e.projectId,
          service: e.service || '',
          ...e.data,
        })));
      } catch (error) {
        this.logger.error(`Failed to insert ${type} events`, error);
        this.buffer.unshift(...events);
      }
    }
  }
}
