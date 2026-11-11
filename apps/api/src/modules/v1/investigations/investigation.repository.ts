import { Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../common/db";
import {
  findings,
  investigationCases,
  projects,
} from "../../../common/db/schema";

export type InvestigationCaseStatus = "open" | "investigating" | "resolved" | "closed";

const ALLOWED_INVESTIGATION_TRANSITIONS: Record<InvestigationCaseStatus, readonly InvestigationCaseStatus[]> = {
  open: ["investigating", "resolved", "closed"],
  investigating: ["resolved", "closed", "open"],
  resolved: ["closed", "investigating"],
  closed: [],
};

@Injectable()
export class InvestigationRepository {
  async list(projectId: string, orgId: string) {
    return db
      .select({ investigation: investigationCases })
      .from(investigationCases)
      .innerJoin(projects, eq(investigationCases.projectId, projects.id))
      .where(
        and(
          eq(investigationCases.projectId, projectId),
          eq(investigationCases.orgId, orgId),
          eq(projects.organizationId, orgId),
        ),
      )
      .orderBy(desc(investigationCases.createdAt));
  }

  async getById(id: string, orgId: string) {
    const [row] = await db
      .select({ investigation: investigationCases })
      .from(investigationCases)
      .innerJoin(projects, eq(investigationCases.projectId, projects.id))
      .where(
        and(
          eq(investigationCases.id, id),
          eq(investigationCases.orgId, orgId),
          eq(projects.organizationId, orgId),
        ),
      )
      .limit(1);

    return row?.investigation;
  }

  async findOpenByFinding(findingId: string, orgId: string) {
    const [row] = await db
      .select({ investigation: investigationCases })
      .from(investigationCases)
      .where(
        and(
          eq(investigationCases.findingId, findingId),
          eq(investigationCases.orgId, orgId),
          eq(investigationCases.status, "open"),
        ),
      )
      .limit(1);

    return row?.investigation;
  }

  async getFinding(findingId: string, orgId: string) {
    const [row] = await db
      .select({ finding: findings })
      .from(findings)
      .innerJoin(projects, eq(findings.projectId, projects.id))
      .where(
        and(
          eq(findings.id, findingId),
          eq(findings.orgId, orgId),
          eq(projects.organizationId, orgId),
        ),
      )
      .limit(1);

    return row?.finding;
  }

  async create(data: typeof investigationCases.$inferInsert) {
    const [investigation] = await db
      .insert(investigationCases)
      .values({ ...data, status: data.status ?? "open" })
      .returning();

    if (!investigation) throw new Error("Failed to create investigation case");
    return investigation;
  }

  async transitionStatus(
    id: string,
    orgId: string,
    fromStatus: InvestigationCaseStatus,
    toStatus: InvestigationCaseStatus,
  ) {
    const allowed = ALLOWED_INVESTIGATION_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new Error(`Invalid investigation transition: ${fromStatus} -> ${toStatus}`);
    }

    const [updated] = await db
      .update(investigationCases)
      .set({ status: toStatus, updatedAt: new Date() })
      .where(
        and(
          eq(investigationCases.id, id),
          eq(investigationCases.orgId, orgId),
          eq(investigationCases.status, fromStatus),
        ),
      )
      .returning();

    return updated;
  }
}
