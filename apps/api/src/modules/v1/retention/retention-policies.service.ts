import { Injectable, Logger } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { db } from "../../../common/db";
import { retentionPolicies } from "../../../common/db/schema";
import { quickwitTenantQuery } from "../../../common/quickwit/query";
import { QuickwitService } from "@soonwhy/shared";
import {
  QUICKWIT_INDEX_BY_DATA_TYPE,
  RETENTION_TIMESTAMP_FIELD,
} from "./retention.constants";
import { retentionCutoff } from "./retention.schedule";
import type { CleanupPolicyResult, ExportResult } from "./retention.types";

type RetentionPolicy = typeof retentionPolicies.$inferSelect;

@Injectable()
export class RetentionPoliciesService {
  private readonly logger = new Logger(RetentionPoliciesService.name);

  constructor(private readonly quickwit: QuickwitService) {}

  async createPolicy(data: {
    orgId: string;
    projectId: string;
    dataType: string;
    retentionDays: number;
    maxStorageGb?: number;
    autoCleanup?: boolean;
    cleanupSchedule?: string;
  }) {
    const [policy] = await db
      .insert(retentionPolicies)
      .values({
        ...data,
        autoCleanup: data.autoCleanup ?? true,
        cleanupSchedule: data.cleanupSchedule ?? "daily",
      })
      .returning();
    return policy;
  }

  async getPolicies(orgId: string, projectId: string) {
    return db
      .select()
      .from(retentionPolicies)
      .where(
        and(
          eq(retentionPolicies.orgId, orgId),
          eq(retentionPolicies.projectId, projectId),
          eq(retentionPolicies.isActive, true),
        ),
      );
  }

  async getAllActivePolicies(): Promise<RetentionPolicy[]> {
    return db
      .select()
      .from(retentionPolicies)
      .where(eq(retentionPolicies.isActive, true));
  }

  async updatePolicy(id: number, data: {
    retentionDays?: number;
    maxStorageGb?: number;
    autoCleanup?: boolean;
    cleanupSchedule?: string;
    isActive?: boolean;
  }) {
    const [policy] = await db
      .update(retentionPolicies)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(retentionPolicies.id, id))
      .returning();
    return policy;
  }

  async deletePolicy(id: number) {
    await db.delete(retentionPolicies).where(eq(retentionPolicies.id, id));
  }

  async executePolicy(policy: RetentionPolicy, now = new Date()): Promise<CleanupPolicyResult> {
    const cutoffDate = retentionCutoff(now, policy.retentionDays);
    const cutoffIso = cutoffDate.toISOString();
    const indexId = QUICKWIT_INDEX_BY_DATA_TYPE[policy.dataType] ?? policy.dataType;

    if (!policy.autoCleanup) {
      return {
        policyId: policy.id,
        dataType: policy.dataType,
        success: true,
        skipped: true,
        cutoffDate: cutoffIso,
      };
    }

    try {
      const query = quickwitTenantQuery(
        policy.orgId,
        policy.projectId,
        `${RETENTION_TIMESTAMP_FIELD}:[* TO ${cutoffIso}]`,
      );
      await this.quickwit.purgeByQuery(indexId, query);

      await db
        .update(retentionPolicies)
        .set({ lastCleanupAt: now })
        .where(eq(retentionPolicies.id, policy.id));

      this.logger.log(
        `Purged ${policy.dataType} before ${cutoffIso} for ${policy.orgId}/${policy.projectId}`,
      );

      return {
        policyId: policy.id,
        dataType: policy.dataType,
        success: true,
        skipped: false,
        cutoffDate: cutoffIso,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to purge ${policy.dataType} for policy ${policy.id}: ${message}`);

      return {
        policyId: policy.id,
        dataType: policy.dataType,
        success: false,
        skipped: false,
        cutoffDate: cutoffIso,
        error: message,
      };
    }
  }

  async executeCleanup(orgId: string, projectId: string): Promise<CleanupPolicyResult[]> {
    const policies = await this.getPolicies(orgId, projectId);
    const results: CleanupPolicyResult[] = [];

    for (const policy of policies) {
      results.push(await this.executePolicy(policy));
    }

    return results;
  }

  async exportDataBeforeDeletion(
    orgId: string,
    projectId: string,
    dataType: string,
    beforeDate: Date,
  ): Promise<ExportResult> {
    const indexId = QUICKWIT_INDEX_BY_DATA_TYPE[dataType] ?? dataType;
    const query = quickwitTenantQuery(
      orgId,
      projectId,
      `timestamp < "${beforeDate.toISOString()}"`,
    );

    try {
      const result = await this.quickwit.search(indexId, {
        query,
        maxHits: 10_000,
      });

      return {
        orgId,
        projectId,
        dataType,
        beforeDate,
        status: "completed",
        recordCount: result.hits.length,
        data: result.hits,
      };
    } catch (error) {
      this.logger.error(`Failed to export data for ${dataType}`, error);
      return {
        orgId,
        projectId,
        dataType,
        beforeDate,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getOptimizationRecommendations(orgId: string, projectId: string) {
    const policies = await this.getPolicies(orgId, projectId);
    const recommendations = [];

    for (const policy of policies) {
      if (policy.retentionDays > 90) {
        recommendations.push({
          dataType: policy.dataType,
          currentRetention: policy.retentionDays,
          recommendedRetention: 30,
          reason: "Long retention periods increase storage costs",
          potentialSavings: ((policy.retentionDays - 30) / policy.retentionDays) * 100,
        });
      }

      if (policy.retentionDays < 7) {
        recommendations.push({
          dataType: policy.dataType,
          currentRetention: policy.retentionDays,
          recommendedRetention: 7,
          reason: "Very short retention may impact debugging capabilities",
          potentialSavings: 0,
        });
      }
    }

    return recommendations;
  }
}
