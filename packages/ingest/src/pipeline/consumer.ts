import { Injectable, OnModuleInit, BadRequestException } from "@nestjs/common";
import {
  QuickwitService,
  QUICKWIT_INDEX_CONFIG,
  QUICKWIT_INDEXES,
  NatsService,
  type NatsMessageHandler,
  type CaptureSettings,
} from "@soonwhy/shared";
import { IngestStats } from "./stats";
import {
  mapLogToRow,
  mapMetricToRow,
  mapSpanToRequestRow,
  mapSpanToTraceRow,
} from "../parse/mappers";
import type {
  ParsedLogRecord,
  ParsedMetricPoint,
  ParsedSpan,
  OrganizationContext,
} from "../interfaces";

type JsMsg = Parameters<NatsMessageHandler>[0];

const MAX_DELIVERY_ATTEMPTS = 5;

type Signal = "trace" | "log" | "metric";

type IngestPayload = {
  projectId: string;
  organizationId: string;
  captureSettings?: CaptureSettings;
  [key: string]: unknown;
};

@Injectable()
export class IngestConsumer implements OnModuleInit {
  constructor(
    private readonly nats: NatsService,
    private readonly quickwit: QuickwitService,
    private readonly metrics: IngestStats,
  ) {}

  async onModuleInit() {
    const signals: Signal[] = ["trace", "log", "metric"];
    await Promise.all(
      Object.values(QUICKWIT_INDEXES).map((indexId) =>
        this.quickwit.ensureIndex(indexId, QUICKWIT_INDEX_CONFIG),
      ),
    );
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

    await this.nats.subscribe(
      "ingest.dlq.>",
      async (msg) => {
        msg.ack();
      },
      { durable: "ingest-dlq", maxDeliver: 3 },
    );

    this.metrics.startPeriodicLogging();
  }

  private async handleMessage(signal: Signal, msg: JsMsg) {
    const deliveryCount = msg.info.deliveryCount || 1;

    if (deliveryCount > MAX_DELIVERY_ATTEMPTS) {
      await this.sendToDlq(
        signal,
        msg.data,
        deliveryCount,
        "max delivery attempts",
      );
      msg.ack();
      this.metrics.recordDlq(1);
      return;
    }

    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.data)) as IngestPayload;
      await this.insertOne(signal, payload);
      msg.ack();
      this.metrics.recordInserted(1);
    } catch (error) {
      this.metrics.recordError();
      if (deliveryCount >= MAX_DELIVERY_ATTEMPTS) {
        await this.sendToDlq(
          signal,
          msg.data,
          deliveryCount,
          error instanceof Error ? error.message : "insert failed",
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
  }

  private organizationFrom(payload: IngestPayload): OrganizationContext {
    return {
      projectId: payload.projectId,
      organizationId: payload.organizationId,
      captureSettings: payload.captureSettings ?? {
        redactSensitiveData: true,
        captureRequestHeaders: false,
        captureRequestBody: false,
        captureResponseBody: false,
        maxAttributeCount: 100,
        maxAttributeValueLength: 4096,
      },
    };
  }

  private async insertOne(signal: Signal, payload: IngestPayload) {
    const organization = this.organizationFrom(payload);
    if (!organization.projectId || !organization.organizationId) {
      throw new BadRequestException("Missing organization on ingest payload");
    }

    if (signal === "trace") {
      const span = payload as unknown as ParsedSpan & OrganizationContext;
      await this.quickwit.ingest(QUICKWIT_INDEXES.traces, [
        mapSpanToTraceRow(span, organization),
      ]);
      const request = mapSpanToRequestRow(span, organization);
      if (request)
        await this.quickwit.ingest(QUICKWIT_INDEXES.requests, [request]);
      return;
    }

    if (signal === "log") {
      const record = payload as unknown as ParsedLogRecord & OrganizationContext;
      await this.quickwit.ingest(QUICKWIT_INDEXES.logs, [
        mapLogToRow(record, organization),
      ]);
      return;
    }

    const point = payload as unknown as ParsedMetricPoint & OrganizationContext;
    await this.quickwit.ingest(QUICKWIT_INDEXES.metrics, [
      mapMetricToRow(point, organization),
    ]);
  }
}
