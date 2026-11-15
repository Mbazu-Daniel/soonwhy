import { Injectable } from "@nestjs/common";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "../../../common/db";
import { searchAudit } from "../../../common/db/schema";

export interface SearchAuditEntry {
  orgId: string;
  projectId: string;
  userId: string | null;
  actor: string;
  action: string;
  params: Record<string, string>;
}

@Injectable()
export class SearchAuditRepository {
  async insert(entry: SearchAuditEntry): Promise<void> {
    await db.insert(searchAudit).values(entry);
  }

  list(orgId: string, options: { projectId?: string; before?: number; limit: number }) {
    return db
      .select()
      .from(searchAudit)
      .where(
        and(
          eq(searchAudit.orgId, orgId),
          options.projectId ? eq(searchAudit.projectId, options.projectId) : undefined,
          options.before ? lt(searchAudit.id, options.before) : undefined,
        ),
      )
      .orderBy(desc(searchAudit.id))
      .limit(options.limit);
  }
}
