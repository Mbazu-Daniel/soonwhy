import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class IngestStats {
  private readonly logger = new Logger(IngestStats.name);
  private accepted = 0;
  private rejected = 0;
  private published = 0;
  private inserted = 0;
  private dlq = 0;
  private errors = 0;
  private latencySumMs = 0;
  private latencyCount = 0;
  private logTimer: ReturnType<typeof setInterval> | null = null;

  startPeriodicLogging(intervalMs = 60_000) {
    if (this.logTimer) return;
    this.logTimer = setInterval(() => {
      const avg =
        this.latencyCount === 0 ? 0 : this.latencySumMs / this.latencyCount;
      const eps = this.accepted / Math.max(1, process.uptime());
      this.logger.log(
        `ingest metrics accepted=${this.accepted} rejected=${this.rejected} published=${this.published} inserted=${this.inserted} dlq=${this.dlq} errors=${this.errors} avgLatencyMs=${avg.toFixed(1)} eventsPerSec=${eps.toFixed(2)}`,
      );
    }, intervalMs);
    this.logTimer.unref?.();
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
