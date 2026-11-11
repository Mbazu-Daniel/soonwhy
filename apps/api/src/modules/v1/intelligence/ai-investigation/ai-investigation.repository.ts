import { Injectable, Optional } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { aiInvestigations } from "../../../../common/db/schema";
import type { InvestigationResult, InvestigationProgress } from "./ai-investigation.types";
import { db } from "../../../../common/db";

@Injectable()
export class AIInvestigationRepository {
  constructor(@Optional() private readonly customDb?: PostgresJsDatabase<any>) {
    this.db = customDb || db;
  }

  private readonly db: PostgresJsDatabase<any>;

  async createInvestigation(
    organizationId: string,
    investigationId: string,
    projectId: string,
  ): Promise<void> {
    await this.db.insert(aiInvestigations).values({
      organizationId,
      investigationId,
      projectId,
      status: "pending",
      progress: "0",
      currentStep: "Initializing",
      startedAt: new Date(),
    });
  }

  async updateProgress(
    organizationId: string,
    investigationId: string,
    progress: number,
    currentStep: string,
  ): Promise<void> {
    await this.db
      .update(aiInvestigations)
      .set({
        progress: progress.toString(),
        currentStep,
      })
      .where(
        and(
          eq(aiInvestigations.organizationId, organizationId),
          eq(aiInvestigations.investigationId, investigationId),
        ),
      );
  }

  async completeInvestigation(
    organizationId: string,
    investigationId: string,
    result: InvestigationResult,
  ): Promise<void> {
    await this.db
      .update(aiInvestigations)
      .set({
        status: "complete",
        progress: "100",
        currentStep: "Complete",
        result: result as any,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(aiInvestigations.organizationId, organizationId),
          eq(aiInvestigations.investigationId, investigationId),
        ),
      );
  }

  async failInvestigation(
    organizationId: string,
    investigationId: string,
    error: string,
  ): Promise<void> {
    await this.db
      .update(aiInvestigations)
      .set({
        status: "failed",
        currentStep: `Error: ${error}`,
        error,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(aiInvestigations.organizationId, organizationId),
          eq(aiInvestigations.investigationId, investigationId),
        ),
      );
  }

  async getProgress(
    organizationId: string,
    investigationId: string,
  ): Promise<InvestigationProgress | null> {
    const result = await this.db
      .select()
      .from(aiInvestigations)
      .where(
        and(
          eq(aiInvestigations.organizationId, organizationId),
          eq(aiInvestigations.investigationId, investigationId),
        ),
      )
      .limit(1);

    if (!result[0]) return null;

    const row = result[0];
    return {
      investigationId: row.investigationId,
      status: row.status as any,
      progress: parseInt(row.progress, 10),
      currentStep: row.currentStep || "",
    };
  }

  async getResult(
    organizationId: string,
    investigationId: string,
  ): Promise<InvestigationResult | null> {
    const result = await this.db
      .select()
      .from(aiInvestigations)
      .where(
        and(
          eq(aiInvestigations.organizationId, organizationId),
          eq(aiInvestigations.investigationId, investigationId),
        ),
      )
      .limit(1);

    if (!result[0] || !result[0].result) return null;

    return result[0].result as InvestigationResult;
  }
}
