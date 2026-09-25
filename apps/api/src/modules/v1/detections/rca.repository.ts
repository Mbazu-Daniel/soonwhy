import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../../common/db';
import { findings, rcaAnalyses } from '../../../common/db/schema';

export interface CreateRcaAnalysisInput {
  orgId: string;
  projectId: string;
  findingId: string;
  serviceName: string;
  severity: string;
  summary: string;
  rootCause: string;
  contributingFactors: string[];
  investigationSteps: string[];
  suggestedChanges: string[];
  evidenceRefs: string[];
  limitations: string[];
  confidence: string;
  evidenceSnapshot: Record<string, unknown>;
  provider: string;
  model: string;
  promptVersion: string;
}

export class RcaAnalysisRepository {
  async create(input: CreateRcaAnalysisInput) {
    const [row] = await db.insert(rcaAnalyses).values(input).returning();
    if (!row) throw new Error('Failed to persist RCA analysis');
    return row;
  }

  async findLatest(orgId: string, projectId: string, findingId: string) {
    const [row] = await db
      .select()
      .from(rcaAnalyses)
      .where(and(
        eq(rcaAnalyses.orgId, orgId),
        eq(rcaAnalyses.projectId, projectId),
        eq(rcaAnalyses.findingId, findingId),
      ))
      .orderBy(desc(rcaAnalyses.createdAt))
      .limit(1);
    return row;
  }

  async list(orgId: string, projectId: string, findingId: string) {
    return db
      .select()
      .from(rcaAnalyses)
      .where(and(
        eq(rcaAnalyses.orgId, orgId),
        eq(rcaAnalyses.projectId, projectId),
        eq(rcaAnalyses.findingId, findingId),
      ))
      .orderBy(desc(rcaAnalyses.createdAt));
  }

  async findFinding(orgId: string, projectId: string, findingId: string) {
    const [row] = await db
      .select()
      .from(findings)
      .where(and(
        eq(findings.orgId, orgId),
        eq(findings.projectId, projectId),
        eq(findings.id, findingId),
      ))
      .limit(1);
    return row;
  }
}
