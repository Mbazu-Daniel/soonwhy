import { Injectable, Optional } from "@nestjs/common";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { deadLetterInvestigations } from "../../../../common/db/schema";
import type { InvestigationRequest } from "./ai-investigation.types";
import { db } from "../../../../common/db";

@Injectable()
export class DeadLetterInvestigationRepository {
  constructor(@Optional() private readonly customDb?: PostgresJsDatabase<any>) {
    this.db = customDb || db;
  }

  private readonly db: PostgresJsDatabase<any>;

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
      request: request as any,
      error,
      attemptCount: attemptCount.toString(),
      lastAttemptAt: new Date(),
      expiresAt,
    });
  }

}
