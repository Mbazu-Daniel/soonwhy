import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { db } from "../../../common/db";
import { schemaCatalog, savedQueries } from "../../../common/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "../../../common/db/generate-id";

@Injectable()
export class QueryCatalogService {
  private readonly logger = new Logger(QueryCatalogService.name);

  async updateSchemaField(
    orgId: string,
    projectId: string,
    dataType: string,
    fieldName: string,
    fieldType: string,
    values: unknown[] = [],
  ) {
    await db
      .insert(schemaCatalog)
      .values({
        id: `${orgId}:${projectId}:${dataType}:${fieldName}`,
        orgId,
        projectId,
        dataType,
        fieldName,
        fieldType,
        values,
      })
      .onConflictDoUpdate({
        target: schemaCatalog.id,
        set: {
          fieldType,
          values,
          updatedAt: new Date(),
        },
      });
  }

  async getSchema(
    orgId: string,
    projectId: string,
    dataType?: string,
  ) {
    const conditions = [eq(schemaCatalog.orgId, orgId), eq(schemaCatalog.projectId, projectId)];
    if (dataType) {
      conditions.push(eq(schemaCatalog.dataType, dataType));
    }

    return db
      .select()
      .from(schemaCatalog)
      .where(and(...conditions))
      .orderBy(schemaCatalog.fieldName);
  }

  async saveQuery(
    orgId: string,
    projectId: string,
    name: string,
    description: string | undefined,
    dataType: string,
    query: Record<string, unknown>,
  ) {
    const [saved] = await db
      .insert(savedQueries)
      .values({
        id: generateId(),
        orgId,
        projectId,
        name,
        description,
        dataType,
        query,
      })
      .returning();
    return saved;
  }

  async getSavedQueries(
    orgId: string,
    projectId: string,
    dataType?: string,
  ) {
    const conditions = [eq(savedQueries.orgId, orgId), eq(savedQueries.projectId, projectId)];
    if (dataType) {
      conditions.push(eq(savedQueries.dataType, dataType));
    }

    return db
      .select()
      .from(savedQueries)
      .where(and(...conditions))
      .orderBy(desc(savedQueries.updatedAt));
  }

  async getSavedQuery(orgId: string, projectId: string, id: string) {
    const [saved] = await db
      .select()
      .from(savedQueries)
      .where(this.ownedBy(orgId, projectId, id))
      .limit(1);
    if (!saved) throw new NotFoundException("Saved query not found");
    return saved;
  }

  async deleteSavedQuery(orgId: string, projectId: string, id: string) {
    const removed = await db
      .delete(savedQueries)
      .where(this.ownedBy(orgId, projectId, id))
      .returning({ id: savedQueries.id });
    if (!removed.length) throw new NotFoundException("Saved query not found");
  }

  private ownedBy(orgId: string, projectId: string, id: string) {
    return and(
      eq(savedQueries.id, id),
      eq(savedQueries.orgId, orgId),
      eq(savedQueries.projectId, projectId),
    );
  }
}
