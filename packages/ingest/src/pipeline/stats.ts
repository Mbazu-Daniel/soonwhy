import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export type IngestStatsSnapshot = {
  accepted: number; rejected: number; published: number; inserted: number; dlq: number; errors: number;
  averageLatencyMs: number; eventsPerSecond: number; inFlight: number; peakInFlight: number;
};

@Injectable()
export class IngestStats implements OnModuleDestroy {
  private readonly logger = new Logger(IngestStats.name);
  private accepted = 0; private rejected = 0; private published = 0; private inserted = 0; private dlq = 0; private errors = 0;
  private latencySumMs = 0; private latencyCount = 0; private inFlight = 0; private peakInFlight = 0;
  private logTimer: ReturnType<typeof setInterval> | null = null;

  startPeriodicLogging(intervalMs = 60_000) {
    if (this.logTimer) return;
    this.logTimer = setInterval(() => {
      const snapshot = this.snapshot();
      this.logger.log(`ingest metrics accepted=${snapshot.accepted} rejected=${snapshot.rejected} published=${snapshot.published} inserted=${snapshot.inserted} dlq=${snapshot.dlq} errors=${snapshot.errors} avgLatencyMs=${snapshot.averageLatencyMs.toFixed(1)} eventsPerSec=${snapshot.eventsPerSecond.toFixed(2)} inFlight=${snapshot.inFlight} peakInFlight=${snapshot.peakInFlight}`);
    }, intervalMs);
    this.logTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.logTimer) clearInterval(this.logTimer);
    this.logTimer = null;
  }

  snapshot(): IngestStatsSnapshot {
    const averageLatencyMs = this.latencyCount === 0 ? 0 : this.latencySumMs / this.latencyCount;
    return {
      accepted: this.accepted, rejected: this.rejected, published: this.published, inserted: this.inserted, dlq: this.dlq, errors: this.errors,
      averageLatencyMs, eventsPerSecond: this.accepted / Math.max(1, process.uptime()), inFlight: this.inFlight, peakInFlight: this.peakInFlight,
    };
  }

  beginRequest() { this.inFlight += 1; this.peakInFlight = Math.max(this.peakInFlight, this.inFlight); }
  endRequest() { this.inFlight = Math.max(0, this.inFlight - 1); }
  recordAccepted(n: number) { this.accepted += n; }
  recordRejected(n: number) { this.rejected += n; }
  recordPublished(n: number) { this.published += n; }
  recordInserted(n: number) { this.inserted += n; }
  recordDlq(n: number) { this.dlq += n; }
  recordError() { this.errors += 1; }
  recordLatency(ms: number) { this.latencySumMs += ms; this.latencyCount += 1; }
}
