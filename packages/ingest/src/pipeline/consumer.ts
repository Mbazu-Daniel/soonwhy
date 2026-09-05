import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ClickhouseService,
  NatsService,
  type NatsMessageHandler,
} from '@soonwhy/shared';
import { IngestStats } from './stats';
import {
  mapLogToRow,
  mapMetricToRow,
  mapSpanToRequestRow,
  mapSpanToTraceRow,
} from '../parse/mappers';
import type {
  ParsedLogRecord,
  ParsedMetricPoint,
  ParsedSpan,
  TenantContext,
} from '../interfaces';

type JsMsg = Parameters<NatsMessageHandler>[0];

const MAX_DELIVERY_ATTEMPTS = 5;

type Signal = 'trace' | 'log' | 'metric';

@Injectable()
export class IngestConsumer implements OnModuleInit {
  private readonly logger = new Logger(IngestConsumer.name);

  constructor(
    private readonly nats: NatsService,
    private readonly clickhouse: ClickhouseService,
    private readonly metrics: IngestStats,
  ) {}

  async onModuleInit() {
    const signals: Signal[] = ['trace', 'log', 'metric'];
    for (const signal of signals) {
      await this.nats.subscribe(
        `ingest.*.${signal}`,
        (msg) => this.handleMessage(signal, msg),
        {
          durable: `ingest-${signal}`,
          maxDeliver: MAX_DELIVERY_ATTEMPTS + 1,
        },
      );
    }

    // DLQ consumer: log dead-lettered payloads for ops visibility
    await this.nats.subscribe(
      'ingest.dlq.>',
      async (msg) => {
        this.logger.warn(`DLQ message on ${msg.subject}: ${new TextDecoder().decode(msg.data).slice(0, 500)}`);
        msg.ack();
      },
      { durable: 'ingest-dlq', maxDeliver: 3 },
    );

    this.metrics.startPeriodicLogging();
    this.logger.log('OTLP consumer started');
  }

  private async handleMessage(signal: Signal, msg: JsMsg) {
    const deliveryCount = msg.info.deliveryCount || 1;

    if (deliveryCount > MAX_DELIVERY_ATTEMPTS) {
      await this.sendToDlq(signal, msg.data, deliveryCount, 'max delivery attempts');
      msg.ack();
      this.metrics.recordDlq(1);
      return;
    }

    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.data)) as Record<
        string,
        unknown
      >;
      await this.insertOne(signal, payload);
      msg.ack();
      this.metrics.recordInserted(1);
    } catch (error) {
      this.logger.error(`Failed to insert ${signal}`, error as Error);
      this.metrics.recordError();
      if (deliveryCount >= MAX_DELIVERY_ATTEMPTS) {
        await this.sendToDlq(
          signal,
          msg.data,
          deliveryCount,
          error instanceof Error ? error.message : 'insert failed',
        );
        msg.ack();
        this.metrics.recordDlq(1);
      } else {
        msg.nak(1000 * deliveryCount);
      }
    }
  }

  private async sendToDlq(
    signal: Signal,
    data: Uint8Array,
    deliveryCount: number,
    reason: string,
  ) {
    const envelope = {
      signal,
      deliveryCount,
      reason,
      failedAt: new Date().toISOString(),
      payload: new TextDecoder().decode(data),
    };
    await this.nats.publish(
      `ingest.dlq.${signal}`,
      new TextEncoder().encode(JSON.stringify(envelope)),
    );
    this.logger.warn(`Sent ${signal} message to DLQ: ${reason}`);
  }

  private tenantFrom(payload: Record<string, unknown>): TenantContext {
    return {
      projectId: String(payload.projectId || ''),
      organizationId: String(payload.organizationId || ''),
    };
  }

  private async insertOne(signal: Signal, payload: Record<string, unknown>) {
    const tenant = this.tenantFrom(payload);
    if (!tenant.projectId || !tenant.organizationId) {
      throw new Error('Missing tenant on ingest payload');
    }

    if (signal === 'trace') {
      const span = payload as unknown as ParsedSpan & TenantContext;
      await this.clickhouse.insert('traces', [mapSpanToTraceRow(span, tenant)]);
      const request = mapSpanToRequestRow(span, tenant);
      if (request) await this.clickhouse.insert('requests', [request]);
      return;
    }

    if (signal === 'log') {
      const record = payload as unknown as ParsedLogRecord & TenantContext;
      await this.clickhouse.insert('logs', [mapLogToRow(record, tenant)]);
      return;
    }

    const point = payload as unknown as ParsedMetricPoint & TenantContext;
    await this.clickhouse.insert('metrics', [mapMetricToRow(point, tenant)]);
  }
}
