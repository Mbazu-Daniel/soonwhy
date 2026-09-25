import type { RcaAnalysis, RcaEvidence } from './rca.types';
import { RcaAnalysisRepository, type CreateRcaAnalysisInput } from './rca.repository';

export interface PersistRcaAnalysisInput {
  orgId: string; projectId: string; findingId: string; evidence: RcaEvidence; analysis: RcaAnalysis;
  provider: string; model: string; promptVersion: string;
}

export class RcaPersistenceService {
  constructor(private readonly repository: RcaAnalysisRepository) {}
  async persist(input: PersistRcaAnalysisInput) {
    const values: CreateRcaAnalysisInput = {
      orgId: input.orgId, projectId: input.projectId, findingId: input.findingId,
      serviceName: input.evidence.serviceName, severity: input.evidence.severity,
      summary: input.analysis.summary, rootCause: input.analysis.rootCause,
      contributingFactors: input.analysis.contributingFactors, investigationSteps: input.analysis.investigationSteps,
      suggestedChanges: input.analysis.suggestedChanges, evidenceRefs: input.analysis.evidenceRefs,
      limitations: input.analysis.limitations, confidence: input.analysis.confidence,
      evidenceSnapshot: input.evidence, provider: input.provider, model: input.model, promptVersion: input.promptVersion,
    };
    return this.repository.create(values);
  }
  async findLatest(orgId: string, projectId: string, findingId: string) { return this.repository.findLatest(orgId, projectId, findingId); }
  async list(orgId: string, projectId: string, findingId: string) { return this.repository.list(orgId, projectId, findingId); }
}
