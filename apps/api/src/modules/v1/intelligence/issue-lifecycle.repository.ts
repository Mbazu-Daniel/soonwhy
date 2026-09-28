import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../../common/db';
import { issueLifecycles } from '../../../common/db/schema';
import type { IssueLifecycle } from './issue-lifecycle.types';
import type { TelemetryIdentity } from './telemetry-identity.types';

interface StoredIssueLifecycle {
  id: string;
  orgId: string;
  projectId: string;
  issueKey: string;
  identity: TelemetryIdentity;
  status: IssueLifecycle['status'];
  firstObservedAt: Date;
  lastObservedAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveIssueLifecycleInput {
  orgId: string;
  projectId: string;
  lifecycle: IssueLifecycle;
}

export class IssueLifecycleRepository {
  async find(orgId: string, projectId: string, issueKey: string): Promise<IssueLifecycle | undefined> {
    const [row] = await db
      .select()
      .from(issueLifecycles)
      .where(and(
        eq(issueLifecycles.orgId, orgId),
        eq(issueLifecycles.projectId, projectId),
        eq(issueLifecycles.issueKey, issueKey),
      ))
      .limit(1);

    return row ? toLifecycle(row as StoredIssueLifecycle) : undefined;
  }

  async save(input: SaveIssueLifecycleInput): Promise<IssueLifecycle> {
    const [row] = await db
      .insert(issueLifecycles)
      .values({
        orgId: input.orgId,
        projectId: input.projectId,
        issueKey: input.lifecycle.issueKey,
        identity: input.lifecycle.identity,
        status: input.lifecycle.status,
        firstObservedAt: new Date(input.lifecycle.firstObservedAt),
        lastObservedAt: new Date(input.lifecycle.lastObservedAt),
        resolvedAt: input.lifecycle.resolvedAt ? new Date(input.lifecycle.resolvedAt) : null,
      })
      .onConflictDoUpdate({
        target: [issueLifecycles.projectId, issueLifecycles.issueKey],
        set: {
          identity: input.lifecycle.identity,
          status: input.lifecycle.status,
          firstObservedAt: new Date(input.lifecycle.firstObservedAt),
          lastObservedAt: new Date(input.lifecycle.lastObservedAt),
          resolvedAt: input.lifecycle.resolvedAt ? new Date(input.lifecycle.resolvedAt) : null,
          updatedAt: new Date(),
        },
        setWhere: sql`${issueLifecycles.lastObservedAt} <= excluded.last_observed_at`,
      })
      .returning();

    if (row) return toLifecycle(row as StoredIssueLifecycle);

    const existing = await this.find(input.orgId, input.projectId, input.lifecycle.issueKey);
    if (!existing) throw new Error('Failed to persist issue lifecycle');
    return existing;
  }
}

function toLifecycle(row: StoredIssueLifecycle): IssueLifecycle {
  return {
    issueKey: row.issueKey,
    identity: row.identity,
    status: row.status,
    firstObservedAt: row.firstObservedAt.toISOString(),
    lastObservedAt: row.lastObservedAt.toISOString(),
    ...(row.resolvedAt ? { resolvedAt: row.resolvedAt.toISOString() } : {}),
  };
}
