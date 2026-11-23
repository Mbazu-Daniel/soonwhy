import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { QUICKWIT_INDEXES, QuickwitService } from "@soonwhy/shared";
import { AlertNotifier } from "./alert-notifier";
import { ClaimLease } from "./claim-lease";
import { DUPLICATE_CHECK_INTERVAL_MS_DEFAULT, DUPLICATE_CHECK_WINDOW_SECS_DEFAULT } from "./constants";
import { IngestStats } from "./stats";

const MILLISECONDS_PER_SECOND = 1000;

function nonNegativeInteger(configured: string | undefined, fallback: number): number {
  const parsed = Number(configured);
  return Number.isInteger(parsed) && parsed >= 0 && configured !== undefined && configured !== "" ? parsed : fallback;
}

@Injectable()
export class DuplicateMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DuplicateMonitor.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly quickwit: QuickwitService,
    private readonly stats: IngestStats,
    private readonly lease: ClaimLease,
    private readonly notifier: AlertNotifier,
  ) {}

  onModuleInit() {
    const intervalMs = nonNegativeInteger(process.env.INGEST_DUPLICATE_CHECK_INTERVAL_MS, DUPLICATE_CHECK_INTERVAL_MS_DEFAULT);
    if (intervalMs === 0) return;
    this.timer = setInterval(() => void this.checkAll(), intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async checkAll(now = Date.now()): Promise<void> {
    const windowSecs = nonNegativeInteger(process.env.INGEST_DUPLICATE_WINDOW_SECS, DUPLICATE_CHECK_WINDOW_SECS_DEFAULT) || DUPLICATE_CHECK_WINDOW_SECS_DEFAULT;
    const endTimestamp = Math.floor((now - this.lease.ms) / MILLISECONDS_PER_SECOND);
    const range = { startTimestamp: endTimestamp - windowSecs, endTimestamp };

    for (const indexId of Object.values(QUICKWIT_INDEXES)) {
      try {
        const report = await this.quickwit.duplicateReport(indexId, range);
        this.stats.recordSinkDuplicates(indexId, {
          ...report,
          windowStart: new Date(range.startTimestamp * MILLISECONDS_PER_SECOND).toISOString(),
          windowEnd: new Date(range.endTimestamp * MILLISECONDS_PER_SECOND).toISOString(),
          checkedAt: new Date(now).toISOString(),
        });
        if (report.duplicateEventIds > 0) this.raise(indexId, report.duplicateEventIds, report.extraCopies, report.truncated, windowSecs);
      } catch (error) {
        this.logger.warn(`Duplicate check for "${indexId}" failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private raise(indexId: string, ids: number, extra: number, truncated: boolean, windowSecs: number) {
    const atLeast = truncated ? "at least " : "";
    const message = `ALERT sink_duplicates: "${indexId}" holds ${atLeast}${ids} event ids stored more than once (${atLeast}${extra} extra copies) in the last ${windowSecs}s; a write was repeated`;
    this.logger.error(message);
    void this.notifier.notify(`sink_duplicates:${indexId}`, message);
  }
}
