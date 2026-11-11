import { Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { db } from "../../../common/db";
import { CacheService } from "../../../common/cache/cache.service";
import { HEALTH_CHECK_TIMEOUT_MS } from "./health.constants";
import type { DependencyCheck, ReadinessReport } from "./health.types";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly quickwitUrl = (process.env.QUICKWIT_URL ?? "http://localhost:7280").replace(/\/$/, "");

  constructor(private readonly cache: CacheService) {}

  async checkDatabase(): Promise<DependencyCheck> {
    const started = Date.now();

    try {
      await withTimeout(db.execute(sql`select 1`), HEALTH_CHECK_TIMEOUT_MS);
      return { status: "ok", latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: "unavailable",
        latencyMs: Date.now() - started,
        error: errorMessage(error),
      };
    }
  }

  async checkRedis(): Promise<DependencyCheck> {
    const health = await this.cache.health();
    return {
      status: health.status,
      latencyMs: health.latencyMs,
      ...(health.error ? { error: health.error } : {}),
    };
  }

  async checkQuickwit(): Promise<DependencyCheck> {
    const started = Date.now();

    try {
      const response = await withTimeout(
        fetch(`${this.quickwitUrl}/health/live`),
        HEALTH_CHECK_TIMEOUT_MS,
      );
      if (!response.ok) {
        return {
          status: "unavailable",
          latencyMs: Date.now() - started,
          error: `HTTP ${response.status}`,
        };
      }
      return { status: "ok", latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: "unavailable",
        latencyMs: Date.now() - started,
        error: errorMessage(error),
      };
    }
  }

  async readiness(): Promise<ReadinessReport> {
    const [database, redis, quickwit] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQuickwit(),
    ]);

    const dependencies = { database, redis, quickwit };
    const status = database.status === "ok" ? "ok" : "degraded";

    if (status === "degraded") {
      this.logger.warn(`Readiness degraded: database ${database.error ?? "unavailable"}`);
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
    timer.unref?.();

    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
