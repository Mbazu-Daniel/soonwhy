import { Injectable, Logger } from "@nestjs/common";
import { QUICKWIT_INDEXES, QuickwitService } from "@soonwhy/shared";
import { IngestHealthService } from "../ingest-health/ingest-health.service";
import type { PipelineLagMetrics } from "../ingest-health/ingest-health.types";

type TelemetryTimestamp = { timestamp?: string };

@Injectable()
export class PipelineLagService {
  private readonly logger = new Logger(PipelineLagService.name);

  constructor(
    private readonly quickwit: QuickwitService,
    private readonly ingestHealth: IngestHealthService,
  ) {}

  async getLagMetrics(): Promise<PipelineLagMetrics> {
    try {
      const [lag, health] = await Promise.all([
        this.getQuickwitIndexingLag(),
        this.ingestHealth.getSnapshot(),
      ]);
      return {
        quickwitIndexingLagMs: lag.lagMs,
        quickwitPendingDocs: health.consumers.reduce(
          (total, consumer) => total + consumer.pending,
          0,
        ),
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Failed to get pipeline lag metrics", error);
      return {
        quickwitIndexingLagMs: 0,
        quickwitPendingDocs: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  private async getQuickwitIndexingLag(): Promise<{ lagMs: number }> {
    let maxIndexedTimestamp = 0;

    for (const indexId of Object.values(QUICKWIT_INDEXES)) {
      try {
        const result = await this.quickwit.search<TelemetryTimestamp>(indexId, {
          query: "*",
          maxHits: 1,
          sortBy: ["timestamp:desc"],
        });
        const hit = result.hits[0];
        if (!hit) continue;
        const timestamp = hit.timestamp || hit._source?.timestamp;
        if (!timestamp || typeof timestamp !== 'string') continue;
        const indexedTime = new Date(timestamp).getTime();
        if (Number.isFinite(indexedTime))
          maxIndexedTimestamp = Math.max(maxIndexedTimestamp, indexedTime);
      } catch {
        continue;
      }
    }

    return {
      lagMs:
        maxIndexedTimestamp > 0 ? Math.max(0, Date.now() - maxIndexedTimestamp) : 0,
    };
  }
}
