import { Injectable, Optional } from "@nestjs/common";
import type { AppDatabase } from "../../../../../common/db/types";
import { db } from "../../../../../common/db";
import { deadLetterInvestigations } from "../../../../../common/db/schema";
import type { InvestigationRequest } from "./ai-investigation.types";

@Injectable()
export class DeadLetterInvestigationRepository {
  private readonly db: AppDatabase;

  constructor(@Optional() customDb?: AppDatabase) {
    this.db = customDb ?? db;
  }

  async addFailedInvestigation(
    organizationId: string,
    investigationId: string,
    projectId: string,
    request: InvestigationRequest,
    error: string,
    attemptCount: number,
    expiresAt?: Date,
  ): Promise<void> {
    await this.db.insert(deadLetterInvestigations).values({
      organizationId,
      investigationId,
      projectId,
      request,
      error,
      attemptCount: attemptCount.toString(),
      lastAttemptAt: new Date(),
      expiresAt,
    });
  }
}
