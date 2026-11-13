import { Injectable } from "@nestjs/common";
import type { IngestHealthSnapshot, IngestStatsHealth } from "./ingest-health.types";

const EMPTY_STATS: IngestStatsHealth = {
  accepted: 0,
  rejected: 0,
  published: 0,
  inserted: 0,
  duplicates: 0,
  dlq: 0,
  errors: 0,
  averageLatencyMs: 0,
  eventsPerSecond: 0,
  inFlight: 0,
  peakInFlight: 0,
};

import { requiredEnvInProduction } from "@soonwhy/shared";

@Injectable()
export class IngestHealthService {
  private readonly baseUrl = (
    requiredEnvInProduction("INGEST_URL", "http://localhost:3002")
  ).replace(/\/$/, "");

  async getSnapshot(): Promise<IngestHealthSnapshot> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health/stats`, {
        signal: AbortSignal.timeout(
          Number(process.env.INGEST_HEALTH_TIMEOUT_MS ?? 2000),
        ),
      });
      if (!response.ok)
        throw new Error(`Ingest health returned ${response.status}`);
      const body = (await response.json()) as Omit<
        IngestHealthSnapshot,
        "available"
      >;
      return { available: true, ...body };
    } catch (error) {
      return {
        available: false,
        stats: EMPTY_STATS,
        capacity: null,
        consumers: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
