import { Inject, Injectable } from "@nestjs/common";
import { RcaAnalysisRepository } from "../infrastructure/rca.repository";
import { type CreateRcaAnalysisInput } from "../domain/rca.repository.types";
import type { PersistRcaAnalysisInput } from "../domain/rca.persistence.types";

@Injectable()
export class RcaPersistenceService {
  constructor(
    @Inject(RcaAnalysisRepository) private readonly repository: Pick<
      RcaAnalysisRepository,
      "create" | "findLatest" | "list"
    >,
  ) {}

  async persist(input: PersistRcaAnalysisInput) {
    const values: CreateRcaAnalysisInput = {
      orgId: input.orgId,
      projectId: input.projectId,
      findingId: input.findingId,
      serviceName: input.evidence.serviceName,
      severity: input.evidence.severity,
      summary: input.analysis.summary,
      rootCause: input.analysis.rootCause,
      contributingFactors: input.analysis.contributingFactors,
      investigationSteps: input.analysis.investigationSteps,
      suggestedChanges: input.analysis.suggestedChanges,
      evidenceRefs: input.analysis.evidenceRefs,
      limitations: input.analysis.limitations,
      confidence: input.analysis.confidence,
      evidenceSnapshot: JSON.parse(
        JSON.stringify({ ...input.evidence, rcaUsage: input.usage }),
      ) as Record<string, unknown>,
      provider: input.provider,
      model: input.model,
      promptVersion: input.promptVersion,
      credentialSource: input.credentialSource,
      trigger: input.trigger ?? "manual",
      evidenceHash: input.evidenceHash ?? null,
    };

    return this.repository.create(values);
  }

  async findLatest(orgId: string, projectId: string, findingId: string) {
    return this.repository.findLatest(orgId, projectId, findingId);
  }

  async list(orgId: string, projectId: string, findingId: string) {
    return this.repository.list(orgId, projectId, findingId);
  }
}
