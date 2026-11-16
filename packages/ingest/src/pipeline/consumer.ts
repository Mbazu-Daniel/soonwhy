import { Injectable, Logger, OnModuleInit, BadRequestException } from "@nestjs/common";
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
import { CLAIM_LEASE_MS, DLQ_SUBJECT_PREFIX, MAX_DELIVERY_ATTEMPTS, retryDelayMs } from "./constants";
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

  private readonly logger = new Logger(IngestConsumer.name);

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
    if (msg.subject?.startsWith(DLQ_SUBJECT_PREFIX)) {
      msg.ack();
      return;
    }
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
      const failure =
        error instanceof Error ? error : new Error(String(error));
      this.metrics.recordError();
      if (error instanceof ReceiptBusyError) {
        this.logger.debug(
          `Ingest ${signal} deferred (delivery ${deliveryCount}): ${failure.message}`,
        );
        msg.nak(CLAIM_LEASE_MS);
        return;
      }
      this.logger.error(
        `Ingest ${signal} failed (delivery ${deliveryCount}): ${failure.message}`,
        failure.stack,
      );
      if (deliveryCount >= MAX_DELIVERY_ATTEMPTS) {
        await this.sendToDlq(
          signal,
          msg.data,
          deliveryCount,
          failure.message,
        );
        msg.ack();
        this.metrics.recordDlq(1);
      } else {
        msg.nak(retryDelayMs(deliveryCount));
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

    try {
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
        `${DLQ_SUBJECT_PREFIX}${signal}`,
        new TextEncoder().encode(JSON.stringify(envelope)),
      );
      this.logger.warn(
        `DLQ ${signal} after ${deliveryCount} deliveries: ${reason}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to dead-letter ${signal} message (delivery ${deliveryCount}, reason "${reason}"): ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
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
    batchRows: MappedRow[],
  ) {
    const rows = [...new Map(batchRows.map((row) => [row.eventId, row])).values()];
    const eventIds = rows.map((r) => r.eventId);
    let claim: Awaited<ReturnType<typeof this.receipts.claimBatch>>;
    try {
      claim = await this.receipts.claimBatch(
        eventIds,
        organizationId,
        projectId,
        signal,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Receipt claim for "${indexId}" failed: ${message}`);
    }

    if (claim.busy.size > 0) {
      throw new ReceiptBusyError([...claim.busy][0] ?? "batch busy");
    }

    const toInsert = rows.filter((r) => claim.claimed.has(r.eventId));
    this.metrics.recordDuplicate(claim.committed.size);

    if (toInsert.length === 0) return;

    let step: "quickwit" | "commit" = "quickwit";
    try {
      await this.quickwit.ingest(indexId, toInsert);
      step = "commit";
      await this.commitWithRetry(
        () => this.receipts.commitBatch(toInsert.map((r) => r.eventId)),
        indexId,
        toInsert.length,
      );
      this.metrics.recordInserted(toInsert.length);
    } catch (error) {
      if (step === "quickwit") {
        try {
          await this.receipts.releaseBatch(toInsert.map((r) => r.eventId));
        } catch (releaseError) {
          this.logger.error(
            `Failed to release ${toInsert.length} receipt claims for "${indexId}": ${
              releaseError instanceof Error
                ? releaseError.message
                : String(releaseError)
            }`,
          );
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Quickwit write to "${indexId}" failed: ${message}`);
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Receipt commit for "${indexId}" (${toInsert.length} rows) failed after retries; leaving receipts pending so redeliveries wait out the lease instead of duplicating the Quickwit batch: ${message}`,
      );
      throw new Error(`Receipt commit for "${indexId}" failed: ${message}`);
    }
  }

  private async commitWithRetry(
    commit: () => Promise<unknown>,
    indexId: string,
    rowCount: number,
  ): Promise<void> {
    const delays = [100, 300, 900];
    let lastError: unknown;
    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      try {
        await commit();
        return;
      } catch (error) {
        lastError = error;
        const delay = delays[attempt];
        if (delay === undefined) break;
        this.logger.warn(
          `Receipt commit for "${indexId}" (${rowCount} rows) attempt ${attempt + 1} failed; retrying in ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async insertRow(
    signal: IngestSignal,
    organization: OrganizationContext,
    indexId: string,
    row: MappedRow,
  ) {
    let claimed: Awaited<ReturnType<typeof this.receipts.claim>>;
    try {
      claimed = await this.receipts.claim(
        row.eventId,
        organization.organizationId,
        organization.projectId,
        signal,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Receipt claim for "${indexId}" failed: ${message}`);
    }
    if (claimed === "committed") {
      this.metrics.recordDuplicate(1);
      return;
    }
    if (claimed === "busy") throw new ReceiptBusyError(row.eventId);

    let step: "quickwit" | "commit" = "quickwit";
    try {
      await this.quickwit.ingest(indexId, [row]);
      step = "commit";
      await this.commitWithRetry(
        () => this.receipts.commit(row.eventId),
        indexId,
        1,
      );
      this.metrics.recordInserted(1);
    } catch (error) {
      if (step === "quickwit") {
        try {
          await this.receipts.release(row.eventId);
        } catch (releaseError) {
          this.logger.error(
            `Failed to release receipt claim for "${indexId}": ${
              releaseError instanceof Error
                ? releaseError.message
                : String(releaseError)
            }`,
          );
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Quickwit write to "${indexId}" failed: ${message}`);
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Receipt commit for "${indexId}" (event ${row.eventId}) failed after retries; leaving receipt pending so redeliveries wait out the lease instead of duplicating the Quickwit write: ${message}`,
      );
      throw new Error(`Receipt commit for "${indexId}" failed: ${message}`);
    }
  }
}
