import { Injectable, Logger, OnModuleDestroy, Optional } from "@nestjs/common";
import { AlertNotifier } from "./alert-notifier";
import { REJECTED_DOCS_ALERT_THRESHOLD_DEFAULT } from "./constants";
import type { IngestStatsSnapshot, SinkDuplicateStatus } from "./stats.types";

export function rejectedDocsAlertThreshold(configured: string | undefined = process.env.INGEST_REJECTED_DOCS_ALERT_THRESHOLD): number {
  const parsed = Number(configured);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : REJECTED_DOCS_ALERT_THRESHOLD_DEFAULT;
}

@Injectable()
export class IngestStats implements OnModuleDestroy {
  private readonly logger = new Logger(IngestStats.name);
  private accepted = 0;
  private rejected = 0;
  private published = 0;
  private inserted = 0;
  private rejectedDocs = 0;
  private reconciled = 0;
  private rejectedDocsAtLastTick = 0;
  private duplicates = 0;
  private dlq = 0;
  private errors = 0;
  private latencySumMs = 0;
  private latencyCount = 0;
  private inFlight = 0;
  private peakInFlight = 0;
  private logTimer: ReturnType<typeof setInterval> | null = null;
  private readonly sinkDuplicates = new Map<string, SinkDuplicateStatus>();

  constructor(@Optional() private readonly notifier?: AlertNotifier) {}

  startPeriodicLogging(intervalMs = 60_000) {
    if (this.logTimer) return;
    this.logTimer = setInterval(() => {
      this.checkRejectedDocsAlert();
      const snapshot = this.snapshot();
      this.logger.log(
        `ingest metrics accepted=${snapshot.accepted} rejected=${snapshot.rejected} published=${snapshot.published} inserted=${snapshot.inserted} rejectedDocs=${snapshot.rejectedDocs} reconciled=${snapshot.reconciled} duplicates=${snapshot.duplicates} dlq=${snapshot.dlq} errors=${snapshot.errors} avgLatencyMs=${snapshot.averageLatencyMs.toFixed(1)} eventsPerSec=${snapshot.eventsPerSecond.toFixed(2)} inFlight=${snapshot.inFlight} peakInFlight=${snapshot.peakInFlight}`,
      );
    }, intervalMs);
    this.logTimer.unref?.();
  }

  checkRejectedDocsAlert(threshold = rejectedDocsAlertThreshold()): boolean {
    const delta = this.rejectedDocs - this.rejectedDocsAtLastTick;
    this.rejectedDocsAtLastTick = this.rejectedDocs;
    if (delta < threshold) return false;
    const message = `ALERT rejected_docs: Quickwit rejected ${delta} documents since the last check (threshold ${threshold}); inspect the dead-letter queue`;
    this.logger.error(message);
    void this.notifier?.notify("rejected_docs", message);
    return true;
  }

  onModuleDestroy() {
    if (this.logTimer) clearInterval(this.logTimer);
    this.logTimer = null;
  }

  snapshot(): IngestStatsSnapshot {
    const averageLatencyMs =
      this.latencyCount === 0 ? 0 : this.latencySumMs / this.latencyCount;
    return {
      accepted: this.accepted,
      rejected: this.rejected,
      published: this.published,
      inserted: this.inserted,
      rejectedDocs: this.rejectedDocs,
      reconciled: this.reconciled,
      sinkDuplicates: Object.fromEntries(this.sinkDuplicates),
      duplicates: this.duplicates,
      dlq: this.dlq,
      errors: this.errors,
      averageLatencyMs,
      eventsPerSecond: this.accepted / Math.max(1, process.uptime()),
      inFlight: this.inFlight,
      peakInFlight: this.peakInFlight,
    };
  }

  beginRequest() {
    this.inFlight += 1;
    this.peakInFlight = Math.max(this.peakInFlight, this.inFlight);
  }
  endRequest() {
    this.inFlight = Math.max(0, this.inFlight - 1);
  }
  recordAccepted(n: number) {
    this.accepted += n;
  }
  recordRejected(n: number) {
    this.rejected += n;
  }
  recordPublished(n: number) {
    this.published += n;
  }
  recordInserted(n: number) {
    this.inserted += n;
  }
  recordReconciled(n: number) {
    this.reconciled += n;
  }
  recordSinkDuplicates(indexId: string, status: SinkDuplicateStatus) {
    this.sinkDuplicates.set(indexId, status);
  }
  recordRejectedDocs(n: number) {
    this.rejectedDocs += n;
  }
  recordDuplicate(n: number) {
    this.duplicates += n;
  }
  recordDlq(n: number) {
    this.dlq += n;
  }
  recordError() {
    this.errors += 1;
  }
  recordLatency(ms: number) {
    this.latencySumMs += ms;
    this.latencyCount += 1;
  }
}
