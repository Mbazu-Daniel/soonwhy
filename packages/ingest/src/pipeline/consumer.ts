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
import { DlqRepository } from "./dlq.repository";
import { IngestReceiptRepository, ReceiptBusyError } from "./receipt.repository";
import { CLAIM_LEASE_MS, MAX_DELIVERY_ATTEMPTS } from "./constants";
import type { IngestPayload, IngestSignal } from "./types";

type JsMsg = Parameters<NatsMessageHandler>[0];

type MappedRow = Record<string, unknown> & { eventId: string };

@Injectable()
export class IngestConsumer implements OnModuleInit {
  constructor(
    private readonly nats: NatsService,
    private readonly quickwit: QuickwitService,
    private readonly metrics: IngestStats,
    private readonly dlqRepository: DlqRepository,
    private readonly receipts: IngestReceiptRepository,
  ) {}

  async onModuleInit() {
    const signals: IngestSignal[] = ["trace", "log", "metric"];
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

  private async handleMessage(signal: IngestSignal, msg: JsMsg) {
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
      const payload = JSON.parse(
        new TextDecoder().decode(msg.data),
      ) as IngestPayload;
      const items = this.itemsFrom(payload);
      await this.insertBatch(signal, items);
      msg.ack();
    } catch (error) {
      this.metrics.recordError();
      if (error instanceof ReceiptBusyError) {
        msg.nak(CLAIM_LEASE_MS);
        return;
      }
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

  private itemsFrom(payload: IngestPayload): IngestPayload[] {
    const items = Array.isArray(payload.items) ? payload.items : [payload];
    return items.map((item) => ({
      ...item,
      projectId: String(item.projectId ?? payload.projectId ?? ""),
      organizationId: String(
        item.organizationId ?? payload.organizationId ?? "",
      ),
      captureSettings:
        (item.captureSettings as CaptureSettings | undefined) ??
        payload.captureSettings,
    }));
  }

  private async sendToDlq(
    signal: IngestSignal,
    data: Uint8Array,
    deliveryCount: number,
    reason: string,
  ) {
    const rawData = new TextDecoder().decode(data);
    let payload: unknown;
    let orgId: string | undefined;
    let projectId: string | undefined;

    try {
      payload = JSON.parse(rawData);
      orgId = (payload as IngestPayload).organizationId;
      projectId = (payload as IngestPayload).projectId;
    } catch {
      payload = { raw: rawData, malformed: true };
    }

    await this.dlqRepository.createDlqEntry({
      signal,
      deliveryCount,
      reason,
      payload,
      organizationId: orgId,
      projectId: projectId,
    });

    const envelope = {
      signal,
      deliveryCount,
      reason,
      failedAt: new Date().toISOString(),
      payload: rawData,
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
        captureRequestHeaders: true,
        captureRequestBody: true,
        captureResponseBody: true,
        maxAttributeCount: 100,
        maxAttributeValueLength: 4096,
      },
    };
  }

  private async insertBatch(signal: IngestSignal, payloads: IngestPayload[]) {
    const traceRows: MappedRow[] = [];
    const requestRows: MappedRow[] = [];
    const logRows: MappedRow[] = [];
    const metricRows: MappedRow[] = [];
    let organizationId: string | undefined;
    let projectId: string | undefined;

    for (const payload of payloads) {
      const organization = this.organizationFrom(payload);
      if (!organization.projectId || !organization.organizationId) {
        throw new BadRequestException("Missing organization on ingest payload");
      }

      organizationId = organization.organizationId;
      projectId = organization.projectId;

      if (signal === "trace") {
        const span = payload as unknown as ParsedSpan & OrganizationContext;
        const traceRow = mapSpanToTraceRow(span, organization) as MappedRow;
        traceRows.push(traceRow);
        const requestRow = mapSpanToRequestRow(span, organization) as
          | MappedRow
          | null;
        if (requestRow) requestRows.push(requestRow);
      } else if (signal === "log") {
        const record = payload as unknown as ParsedLogRecord & OrganizationContext;
        const row = mapLogToRow(record, organization) as MappedRow;
        logRows.push(row);
      } else {
        const point = payload as unknown as ParsedMetricPoint & OrganizationContext;
        const row = mapMetricToRow(point, organization) as MappedRow;
        metricRows.push(row);
      }
    }

    if (traceRows.length > 0 && organizationId && projectId) {
      await this.insertRows(signal, organizationId, projectId, QUICKWIT_INDEXES.traces, traceRows);
    }
    if (requestRows.length > 0 && organizationId && projectId) {
      await this.insertRows(signal, organizationId, projectId, QUICKWIT_INDEXES.requests, requestRows);
    }
    if (logRows.length > 0 && organizationId && projectId) {
      await this.insertRows(signal, organizationId, projectId, QUICKWIT_INDEXES.logs, logRows);
    }
    if (metricRows.length > 0 && organizationId && projectId) {
      await this.insertRows(signal, organizationId, projectId, QUICKWIT_INDEXES.metrics, metricRows);
    }
  }

  private async insertItem(signal: IngestSignal, payload: IngestPayload) {
    const organization = this.organizationFrom(payload);
    if (!organization.projectId || !organization.organizationId) {
      throw new BadRequestException("Missing organization on ingest payload");
    }

    if (signal === "trace") {
      const span = payload as unknown as ParsedSpan & OrganizationContext;
      const traceRow = mapSpanToTraceRow(span, organization) as MappedRow;
      await this.insertRow(signal, organization, QUICKWIT_INDEXES.traces, traceRow);
      const requestRow = mapSpanToRequestRow(span, organization) as
        | MappedRow
        | null;
      if (requestRow)
        await this.insertRow(
          signal,
          organization,
          QUICKWIT_INDEXES.requests,
          requestRow,
        );
      return;
    }

    if (signal === "log") {
      const record = payload as unknown as ParsedLogRecord & OrganizationContext;
      const row = mapLogToRow(record, organization) as MappedRow;
      await this.insertRow(signal, organization, QUICKWIT_INDEXES.logs, row);
      return;
    }

    const point = payload as unknown as ParsedMetricPoint & OrganizationContext;
    const row = mapMetricToRow(point, organization) as MappedRow;
    await this.insertRow(signal, organization, QUICKWIT_INDEXES.metrics, row);
  }

  private async insertRows(
    signal: IngestSignal,
    organizationId: string,
    projectId: string,
    indexId: string,
    rows: MappedRow[],
  ) {
    const eventIds = rows.map((r) => r.eventId);
    const { claimed, committed: committedIds, busy } = await this.receipts.claimBatch(
      eventIds,
      organizationId,
      projectId,
      signal,
    );

    if (busy.size > 0) {
      throw new ReceiptBusyError([...busy][0] ?? "batch busy");
    }

    const toInsert = rows.filter((r) => claimed.has(r.eventId));
    this.metrics.recordDuplicate(committedIds.size);

    if (toInsert.length === 0) return;

    try {
      await this.quickwit.ingest(indexId, toInsert);
      await this.receipts.commitBatch(toInsert.map((r) => r.eventId));
      this.metrics.recordInserted(toInsert.length);
    } catch (error) {
      await this.receipts.releaseBatch(toInsert.map((r) => r.eventId));
      throw error;
    }
  }

  private async insertRow(
    signal: IngestSignal,
    organization: OrganizationContext,
    indexId: string,
    row: MappedRow,
  ) {
    const claimed = await this.receipts.claim(
      row.eventId,
      organization.organizationId,
      organization.projectId,
      signal,
    );
    if (claimed === "committed") {
      this.metrics.recordDuplicate(1);
      return;
    }
    if (claimed === "busy") throw new ReceiptBusyError(row.eventId);

    try {
      await this.quickwit.ingest(indexId, [row]);
      await this.receipts.commit(row.eventId);
      this.metrics.recordInserted(1);
    } catch (error) {
      await this.receipts.release(row.eventId);
      throw error;
    }
  }
}
