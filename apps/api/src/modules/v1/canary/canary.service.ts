import { Injectable } from "@nestjs/common";
import { OutboundHttpService } from "../../../common/resilience/outbound-http.service";
import { db } from "../../../common/db";
import { canaryDeployments } from "../../../common/db/schema";
import { and, eq } from "drizzle-orm";

interface CreateCanaryInput {
  orgId: string;
  projectId: string;
  deploymentId?: string;
  name: string;
  targetUrl: string;
  baselineUrl?: string;
  validationRules?: {
    maxResponseTimeMs?: number;
    minSuccessRate?: number;
    errorThreshold?: number;
  };
}

@Injectable()
export class CanaryService {
  constructor(private readonly http: OutboundHttpService) {}

  async createCanary(input: CreateCanaryInput) {
    const [canary] = await db
      .insert(canaryDeployments)
      .values({
        orgId: input.orgId,
        projectId: input.projectId,
        deploymentId: input.deploymentId,
        name: input.name,
        targetUrl: input.targetUrl,
        baselineUrl: input.baselineUrl,
        validationRules: input.validationRules || {},
        status: "pending",
      })
      .returning();
    return canary;
  }

  async runCanary(canaryId: number) {
    const [canary] = await db
      .select()
      .from(canaryDeployments)
      .where(eq(canaryDeployments.id, canaryId))
      .limit(1);

    if (!canary) {
      throw new Error("Canary deployment not found");
    }

    // Claim run atomically: only pending canaries may start.
    const [claimed] = await db
      .update(canaryDeployments)
      .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(canaryDeployments.id, canaryId),
          eq(canaryDeployments.status, "pending"),
        ),
      )
      .returning();

    if (!claimed) {
      throw new Error(
        `Canary deployment is not in a runnable state (current: ${canary.status})`,
      );
    }

    const results: Array<{
      probeId: number;
      status: string;
      responseTimeMs: number;
      timestamp: string;
    }> = [];

    // Run 10 checks over 2 minutes
    const checks = 10;
    const intervalMs = 12000; // 12 seconds between checks

    for (let i = 0; i < checks; i++) {
      const startTime = Date.now();
      let status = "up";
      let responseTimeMs = 0;

      try {
        const response = await this.http.request({
          url: canary.targetUrl,
          preset: "probe",
          source: "CanaryService.runCanary",
          init: { method: "GET" },
        });

        responseTimeMs = Date.now() - startTime;

        if (response.status >= 500) {
          status = "down";
        } else if (response.status >= 400) {
          status = "degraded";
        }
      } catch (error: any) {
        responseTimeMs = Date.now() - startTime;
        status = "down";
      }

      results.push({
        probeId: i,
        status,
        responseTimeMs,
        timestamp: new Date().toISOString(),
      });

      // Wait before next check
      if (i < checks - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    // Calculate metrics
    const totalChecks = results.length;
    const successfulChecks = results.filter((r) => r.status === "up").length;
    const errorCount = results.filter((r) => r.status === "down").length;
    const successRate = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;
    const avgResponseTime =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.responseTimeMs, 0) / results.length
        : 0;

    const metrics = {
      avgResponseTime: Math.round(avgResponseTime),
      successRate: Math.round(successRate),
      errorCount,
      totalChecks,
    };

    try {
      // Validate against rules
      const rules = (canary.validationRules || {}) as {
        maxResponseTimeMs?: number;
        minSuccessRate?: number;
        errorThreshold?: number;
      };
      let passed = true;
      const failures: string[] = [];

      if (rules.maxResponseTimeMs && metrics.avgResponseTime > rules.maxResponseTimeMs) {
        passed = false;
        failures.push(
          `Response time ${metrics.avgResponseTime}ms exceeds threshold ${rules.maxResponseTimeMs}ms`,
        );
      }

      if (rules.minSuccessRate && metrics.successRate < rules.minSuccessRate) {
        passed = false;
        failures.push(
          `Success rate ${metrics.successRate}% below threshold ${rules.minSuccessRate}%`,
        );
      }

      if (rules.errorThreshold && metrics.errorCount > rules.errorThreshold) {
        passed = false;
        failures.push(
          `Error count ${metrics.errorCount} exceeds threshold ${rules.errorThreshold}`,
        );
      }

      // Persist terminal result only from running state.
      await db
        .update(canaryDeployments)
        .set({
          status: passed ? "passed" : "failed",
          probeResults: results,
          metrics,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(canaryDeployments.id, canaryId),
            eq(canaryDeployments.status, "running"),
          ),
        );

      return {
        canaryId,
        status: passed ? "passed" : "failed",
        metrics,
        failures,
      };
    } catch (error) {
      await db
        .update(canaryDeployments)
        .set({
          status: "failed",
          probeResults: results,
          metrics,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(canaryDeployments.id, canaryId),
            eq(canaryDeployments.status, "running"),
          ),
        );
      throw error;
    }
  }

  async getCanary(canaryId: number) {
    const [canary] = await db
      .select()
      .from(canaryDeployments)
      .where(eq(canaryDeployments.id, canaryId))
      .limit(1);
    return canary;
  }

  async getCanaries(orgId: string, projectId: string) {
    return db
      .select()
      .from(canaryDeployments)
      .where(eq(canaryDeployments.orgId, orgId));
  }
}
