import { Injectable, Logger } from "@nestjs/common";
import { capacityMetrics } from "../../../common/db/schema";
import { db } from "../../../common/db";
import { eq, and, gt, lt, desc, avg, or } from "drizzle-orm";

interface CapacityThresholds {
  cpuWarningPercent: number;
  cpuCriticalPercent: number;
  memoryWarningPercent: number;
  memoryCriticalPercent: number;
  eventLoopLagWarningMs: number;
  eventLoopLagCriticalMs: number;
  concurrencyWarningPercent: number;
  concurrencyCriticalPercent: number;
}

@Injectable()
export class CapacityMonitoringService {
  private readonly logger = new Logger(CapacityMonitoringService.name);

  private readonly thresholds: CapacityThresholds = {
    cpuWarningPercent: 70,
    cpuCriticalPercent: 90,
    memoryWarningPercent: 75,
    memoryCriticalPercent: 90,
    eventLoopLagWarningMs: 100,
    eventLoopLagCriticalMs: 500,
    concurrencyWarningPercent: 80,
    concurrencyCriticalPercent: 95,
  };

  async recordMetric(data: {
    orgId: string;
    projectId: string;
    serviceName: string;
    cpuPercent?: number;
    memoryPercent?: number;
    memoryUsedMB?: number;
    memoryTotalMB?: number;
    eventLoopLagMs?: number;
    activeRequests?: number;
    maxConcurrency?: number;
    metadata?: Record<string, unknown>;
  }) {
    const cpuExhausted = data.cpuPercent !== undefined && data.cpuPercent >= this.thresholds.cpuCriticalPercent;
    const memoryExhausted = data.memoryPercent !== undefined && data.memoryPercent >= this.thresholds.memoryCriticalPercent;
    const eventLoopStalled = data.eventLoopLagMs !== undefined && data.eventLoopLagMs >= this.thresholds.eventLoopLagCriticalMs;
    const concurrencyExceeded =
      data.activeRequests !== undefined &&
      data.maxConcurrency !== undefined &&
      data.maxConcurrency > 0 &&
      (data.activeRequests / data.maxConcurrency) * 100 >= this.thresholds.concurrencyCriticalPercent;

    const [created] = await db
      .insert(capacityMetrics)
      .values({
        ...data,
        cpuExhausted,
        memoryExhausted,
        eventLoopStalled,
        concurrencyExceeded,
      })
      .returning();

    if (cpuExhausted || memoryExhausted || eventLoopStalled || concurrencyExceeded) {
      this.logger.warn(
        `Resource exhaustion detected for ${data.serviceName}: CPU=${cpuExhausted}, Memory=${memoryExhausted}, EventLoop=${eventLoopStalled}, Concurrency=${concurrencyExceeded}`,
      );
    }

    return created;
  }

  async getCapacityMetrics(
    orgId: string,
    projectId: string,
    serviceName?: string,
    hoursAgo: number = 24,
  ) {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    if (serviceName) {
      return db
        .select()
        .from(capacityMetrics)
        .where(
          and(
            eq(capacityMetrics.orgId, orgId),
            eq(capacityMetrics.projectId, projectId),
            eq(capacityMetrics.serviceName, serviceName),
            gt(capacityMetrics.timestamp, cutoff),
          ),
        )
        .orderBy(desc(capacityMetrics.timestamp))
        .limit(1000);
    }

    return db
      .select()
      .from(capacityMetrics)
      .where(
        and(
          eq(capacityMetrics.orgId, orgId),
          eq(capacityMetrics.projectId, projectId),
          gt(capacityMetrics.timestamp, cutoff),
        ),
      )
      .orderBy(desc(capacityMetrics.timestamp))
      .limit(1000);
  }

  async getCapacitySummary(
    orgId: string,
    projectId: string,
    hoursAgo: number = 1,
  ) {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    const results = await db
      .select()
      .from(capacityMetrics)
      .where(
        and(
          eq(capacityMetrics.orgId, orgId),
          eq(capacityMetrics.projectId, projectId),
          gt(capacityMetrics.timestamp, cutoff),
        ),
      );

    if (results.length === 0) {
      return {
        avgCpuPercent: 0,
        avgMemoryPercent: 0,
        avgEventLoopLagMs: 0,
        avgActiveRequests: 0,
        cpuExhaustionCount: 0,
        memoryExhaustionCount: 0,
        eventLoopStallCount: 0,
        concurrencyExceededCount: 0,
      };
    }

    const totalCpu = results.reduce((sum, r) => sum + (r.cpuPercent || 0), 0);
    const totalMemory = results.reduce((sum, r) => sum + (r.memoryPercent || 0), 0);
    const totalLag = results.reduce((sum, r) => sum + (r.eventLoopLagMs || 0), 0);
    const totalRequests = results.reduce((sum, r) => sum + (r.activeRequests || 0), 0);

    return {
      avgCpuPercent: totalCpu / results.length,
      avgMemoryPercent: totalMemory / results.length,
      avgEventLoopLagMs: totalLag / results.length,
      avgActiveRequests: totalRequests / results.length,
      cpuExhaustionCount: results.filter((r) => r.cpuExhausted).length,
      memoryExhaustionCount: results.filter((r) => r.memoryExhausted).length,
      eventLoopStallCount: results.filter((r) => r.eventLoopStalled).length,
      concurrencyExceededCount: results.filter((r) => r.concurrencyExceeded).length,
    };
  }

  async getResourceExhaustionAlerts(
    orgId: string,
    projectId: string,
    hoursAgo: number = 1,
  ) {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    const results = await db
      .select()
      .from(capacityMetrics)
      .where(
        and(
          eq(capacityMetrics.orgId, orgId),
          eq(capacityMetrics.projectId, projectId),
          gt(capacityMetrics.timestamp, cutoff),
          or(
            eq(capacityMetrics.cpuExhausted, true),
            eq(capacityMetrics.memoryExhausted, true),
            eq(capacityMetrics.eventLoopStalled, true),
            eq(capacityMetrics.concurrencyExceeded, true),
          ),
        ),
      )
      .orderBy(desc(capacityMetrics.timestamp));

    return results;
  }
}
