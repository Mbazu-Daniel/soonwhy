import { Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../../../common/db";
import { generatePublicId, isPublicIdCollision } from "../../../../../common/db/public-id";
import {
  findings,
  investigationCases,
  projects,
} from "../../../../../common/db/schema";

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

  async getById(publicId: string, orgId: string) {
    const [row] = await db
      .select({ investigation: investigationCases })
      .from(investigationCases)
      .innerJoin(projects, eq(investigationCases.projectId, projects.id))
      .where(
        and(
          eq(investigationCases.publicId, publicId),
          eq(investigationCases.orgId, orgId),
          eq(projects.organizationId, orgId),
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
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const [investigation] = await db
          .insert(investigationCases)
          .values({
            ...data,
            publicId: generatePublicId(),
            status: data.status ?? "open",
          })
          .returning();

        if (!investigation) throw new Error("Failed to create investigation case");
        return investigation;
      } catch (error) {
        if (!isPublicIdCollision(error) || attempt === 2) throw error;
      }
    }
    throw new Error("Failed to create investigation case");
  }
}
