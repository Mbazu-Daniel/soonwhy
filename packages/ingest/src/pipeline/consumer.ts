import { Injectable, Logger, OnModuleInit, BadRequestException } from "@nestjs/common";
import {
  QuickwitService,
  QUICKWIT_INDEX_CONFIG,
  QUICKWIT_INDEXES,
  NatsService,
  QUICKWIT_WRITE_STATE,
  QuickwitIngestError,
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
import { ClaimLease } from "./claim-lease";
import { IngestReceiptRepository, ReceiptBusyError, ReconcileUnavailableError } from "./receipt.repository";
import { findExistingEventIds } from "./reconciler";
import { VisibilityCanary } from "./visibility-canary";
import { DLQ_SUBJECT_PREFIX, MAX_DELIVERY_ATTEMPTS, REJECTED_DOCS_DLQ_DELIVERY_COUNT, retryDelayMs } from "./constants";
import { AmbiguousIngestResultError, splitIngestOutcome, type IngestOutcome } from "./ingest-outcome";
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
    private readonly lease: ClaimLease = new ClaimLease(),
    private readonly canary?: VisibilityCanary,
  ) {}

  private readonly logger = new Logger(IngestConsumer.name);

  async onModuleInit() {
    const signals: IngestSignal[] = ["trace", "log", "metric"];
    await Promise.all(
      Object.values(QUICKWIT_INDEXES).map((indexId) =>
        this.quickwit.ensureIndex(indexId, QUICKWIT_INDEX_CONFIG),
      ),
    );
    await this.configureLease();
    for (const signal of signals) {
      await this.nats.subscribe(
        `ingest.*.${signal}`,
        (msg) => this.handleMessage(signal, msg),
        {
          durable: `ingest-${signal}`,
          maxDeliver: MAX_DELIVERY_ATTEMPTS + 10,
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

  private async configureLease(): Promise<void> {
    try {
      const timeouts = await Promise.all(
        Object.values(QUICKWIT_INDEXES).map((indexId) => this.quickwit.commitTimeoutSecs(indexId)),
      );
      const leaseMs = this.lease.configure(timeouts);
      this.logger.log(`Receipt lease set to ${leaseMs / 1000}s from index commit timeouts of ${timeouts.join(", ")}s`);
    } catch (error) {
      this.logger.warn(
        `Could not read the index commit timeouts; keeping the default receipt lease of ${this.lease.ms / 1000}s: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async handleMessage(signal: IngestSignal, msg: JsMsg) {
    if (msg.subject?.startsWith(DLQ_SUBJECT_PREFIX)) {
      msg.ack();
      return;
    }
    const deliveryCount = msg.info.deliveryCount || 1;

    if (deliveryCount > MAX_DELIVERY_ATTEMPTS) {
      if (!(await this.sendToDlq(signal, msg.data, deliveryCount, "max delivery attempts"))) {
        msg.nak(this.lease.ms);
        return;
      }
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
        msg.nak(this.lease.ms);
        return;
      }
      this.logger.error(
        `Ingest ${signal} failed (delivery ${deliveryCount}): ${failure.message}`,
        failure.stack,
      );
      if (deliveryCount >= MAX_DELIVERY_ATTEMPTS) {
        if (!(await this.sendToDlq(signal, msg.data, deliveryCount, failure.message))) {
          msg.nak(this.lease.ms);
          return;
        }
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
  ): Promise<boolean> {
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
    } catch (error) {
      this.logger.error(
        `Failed to dead-letter ${signal} message (delivery ${deliveryCount}, reason "${reason}"): ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }

    try {
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
      this.logger.warn(
        `Dead-letter ${signal} row saved but the NATS copy failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return true;
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
    const sources = new Map<string, IngestPayload>();
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
        sources.set(traceRow.eventId, payload);
        const requestRow = mapSpanToRequestRow(span, organization) as
          | MappedRow
          | null;
        if (requestRow) {
          requestRows.push(requestRow);
          sources.set(requestRow.eventId, payload);
        }
      } else if (signal === "log") {
        const record = payload as unknown as ParsedLogRecord & OrganizationContext;
        const row = mapLogToRow(record, organization) as MappedRow;
        logRows.push(row);
        sources.set(row.eventId, payload);
      } else {
        const point = payload as unknown as ParsedMetricPoint & OrganizationContext;
        const row = mapMetricToRow(point, organization) as MappedRow;
        metricRows.push(row);
        sources.set(row.eventId, payload);
      }
    }

    if (traceRows.length > 0 && organizationId && projectId) {
      await this.insertRows(signal, organizationId, projectId, QUICKWIT_INDEXES.traces, traceRows, sources);
    }
    if (requestRows.length > 0 && organizationId && projectId) {
      await this.insertRows(signal, organizationId, projectId, QUICKWIT_INDEXES.requests, requestRows, sources);
    }
    if (logRows.length > 0 && organizationId && projectId) {
      await this.insertRows(signal, organizationId, projectId, QUICKWIT_INDEXES.logs, logRows, sources);
    }
    if (metricRows.length > 0 && organizationId && projectId) {
      await this.insertRows(signal, organizationId, projectId, QUICKWIT_INDEXES.metrics, metricRows, sources);
    }
  }

  private async insertRows(
    signal: IngestSignal,
    organizationId: string,
    projectId: string,
    indexId: string,
    batchRows: MappedRow[],
    sources: Map<string, IngestPayload>,
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

    this.metrics.recordDuplicate(claim.committed.size);
    const toInsert = await this.withoutAlreadyStored(
      indexId,
      organizationId,
      rows.filter((r) => claim.claimed.has(r.eventId)),
      claim.reclaimed,
    );

    if (toInsert.length === 0) return;

    let outcome: IngestOutcome<MappedRow>;
    try {
      outcome = splitIngestOutcome(toInsert, await this.quickwit.ingest(indexId, toInsert));
    } catch (error) {
      await this.settleFailedWrite(indexId, organizationId, toInsert, error);
      throw error;
    }

    await this.commitAccepted(indexId, organizationId, outcome.accepted);
    const written = outcome.accepted.at(-1);
    if (written) await this.canary?.record(indexId, written.eventId);
    await this.deadLetterRejected(signal, indexId, organizationId, projectId, outcome, sources);
    this.metrics.recordInserted(outcome.accepted.length);
  }

  private async withoutAlreadyStored(indexId: string, organizationId: string, claimed: MappedRow[], reclaimed: Set<string>): Promise<MappedRow[]> {
    const retried = claimed.filter((row) => reclaimed.has(row.eventId));
    if (retried.length === 0) return claimed;

    let stored: Set<string>;
    try {
      stored = await findExistingEventIds(this.quickwit, indexId, retried);
      if (stored.size < retried.length && (await this.canary?.indexerIsBehind(this.quickwit, indexId, this.lease.ms))) {
        throw new Error("a document written more than one lease ago is still not searchable, so the indexer is behind");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Quickwit lookup for ${retried.length} retried rows in "${indexId}" failed; leaving their receipts pending and deferring the batch instead of writing blind: ${message}`,
      );
      throw new ReconcileUnavailableError(indexId, message);
    }
    if (stored.size === 0) return claimed;

    await this.commitAccepted(indexId, organizationId, claimed.filter((row) => stored.has(row.eventId)));
    this.metrics.recordReconciled(stored.size);
    this.logger.log(`Reconciled ${stored.size} of ${retried.length} retried rows in "${indexId}" already stored in Quickwit; committed their receipts without rewriting`);
    return claimed.filter((row) => !stored.has(row.eventId));
  }

  private async settleFailedWrite(indexId: string, organizationId: string, rows: MappedRow[], error: unknown): Promise<never> {
    const message = error instanceof Error ? error.message : String(error);
    const notWritten = error instanceof QuickwitIngestError && error.writeState === QUICKWIT_WRITE_STATE.notWritten;

    if (notWritten) {
      try {
        await this.receipts.releaseBatch(rows.map((row) => row.eventId), organizationId);
      } catch (releaseError) {
        this.logger.error(
          `Failed to release ${rows.length} receipt claims for "${indexId}": ${
            releaseError instanceof Error ? releaseError.message : String(releaseError)
          }`,
        );
      }
      throw new Error(`Quickwit write to "${indexId}" failed (not written): ${message}`);
    }

    const ambiguous = error instanceof AmbiguousIngestResultError;
    this.logger.warn(
      `Quickwit write to "${indexId}" ${ambiguous ? "returned a response that cannot be matched to the batch" : "failed with an unknown outcome"}; leaving ${rows.length} receipts pending so the retry does not write blind: ${message}`,
    );
    throw new Error(`Quickwit write to "${indexId}" failed (outcome unknown): ${message}`);
  }

  private async commitAccepted(indexId: string, organizationId: string, accepted: MappedRow[]): Promise<void> {
    if (accepted.length === 0) return;
    try {
      await this.commitWithRetry(
        () => this.receipts.commitBatch(accepted.map((row) => row.eventId), organizationId),
        indexId,
        accepted.length,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Receipt commit for "${indexId}" (${accepted.length} rows) failed after retries; leaving receipts pending so redeliveries wait out the lease instead of duplicating the Quickwit batch: ${message}`,
      );
      throw new Error(`Receipt commit for "${indexId}" failed: ${message}`);
    }
  }

  private async deadLetterRejected(
    signal: IngestSignal,
    indexId: string,
    organizationId: string,
    projectId: string,
    outcome: IngestOutcome<MappedRow>,
    sources: Map<string, IngestPayload>,
  ): Promise<void> {
    for (const { row, reason, message } of outcome.rejected) {
      const detail = `Quickwit rejected the document for "${indexId}" (${reason}): ${message}`;
      await this.dlqRepository.createDlqEntry({
        signal,
        deliveryCount: REJECTED_DOCS_DLQ_DELIVERY_COUNT,
        reason: detail,
        payload: sources.get(row.eventId) ?? { rejectedDocument: row },
        organizationId,
        projectId,
      });
      await this.commitWithRetry(() => this.receipts.commitBatch([row.eventId], organizationId), indexId, 1);
      this.metrics.recordRejectedDocs(1);
      this.metrics.recordDlq(1);
      this.logger.warn(`${detail} (event ${row.eventId}); saved to the dead-letter queue`);
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
}
