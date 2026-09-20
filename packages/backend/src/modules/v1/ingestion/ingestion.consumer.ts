import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NatsService } from '../../../nats';
import { ClickhouseService } from '../../../clickhouse';
import type { TelemetryEvent } from '@soonwhy/shared';

const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 100;

const TABLE_BY_TYPE: Record<string, string> = {
  log: 'logs',
  metric: 'metrics',
  error: 'errors',
  request: 'requests',
  trace: 'traces',
};

interface BufferedEvent extends TelemetryEvent {
  orgId: string;
}

@Injectable()
export class IngestionConsumer implements OnModuleInit {
  private readonly logger = new Logger(IngestionConsumer.name);
  private buffer: BufferedEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly nats: NatsService,
    private readonly clickhouse: ClickhouseService,
  ) {}

  async onModuleInit() {
    // Subscribe to all ingest topics
    const types = ['log', 'metric', 'error', 'request', 'trace'];

    for (const type of types) {
      const subject = `ingest.*.${type}`;
      await this.nats.subscribe(subject, async (msg) => {
        try {
          const event = JSON.parse(new TextDecoder().decode(msg.data)) as TelemetryEvent;
          const [, orgId] = msg.subject.split('.');
          this.buffer.push({ ...event, orgId: orgId || '' });

          if (this.buffer.length >= MAX_BATCH_SIZE) {
            await this.flush();
          }
        } catch (error) {
          this.logger.error(`Failed to process message on ${subject}`, error);
        }
      }, { durable: `consumer-${type}`, deliverAll: false });
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        this.logger.error('Flush failed', error);
      });
    }, FLUSH_INTERVAL_MS);

    this.logger.log('Ingestion consumer started');
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const batch = [...this.buffer];
    this.buffer = [];

    // Group by type
    const grouped: Record<string, BufferedEvent[]> = {};
    for (const event of batch) {
      if (!grouped[event.type]) {
        grouped[event.type] = [];
      }
      grouped[event.type].push(event);
    }

    // Insert each type into its table
    for (const [type, events] of Object.entries(grouped)) {
      const table = TABLE_BY_TYPE[type];
      if (!table) {
        this.logger.warn(`Unknown event type: ${type}`);
        continue;
      }

      try {
        const values = events.map((e) => {
          const data = { ...e.data };
          if (type === 'log' && data.attributes && typeof data.attributes === 'object') {
            data.attributes = JSON.stringify(data.attributes);
          }

          return {
            id: e.id,
            timestamp: new Date(e.timestamp).toISOString().replace('T', ' ').replace('Z', ''),
            org_id: e.orgId,
            project_id: e.projectId,
            service: e.service || '',
            ...data,
          };
        });

        await this.clickhouse.insert(table, values);
        this.logger.debug(`Inserted ${events.length} ${type} events`);
      } catch (error) {
        this.logger.error(`Failed to insert ${type} events`, error);
        // Re-queue failed events
        this.buffer.unshift(...events);
      }
    }
  }
}
