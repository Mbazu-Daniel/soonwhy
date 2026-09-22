import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { RcaAnalysisRepository } from './rca.repository';
import { RcaPersistenceService } from './rca.persistence';
import { RcaOrchestrator } from './rca.orchestrator';
import { buildRcaEvidence } from './rca.evidence';
import { RCA_PROMPT_VERSION } from './rca.prompt';
import type { CorrelatedBottleneck } from './detection.correlation';

@Injectable()
export class RcaApiService {
  constructor(
    private readonly repository: Pick<RcaAnalysisRepository, 'findFinding'>,
    private readonly orchestrator: Pick<RcaOrchestrator, 'analyze'>,
    private readonly persistence: Pick<RcaPersistenceService, 'findLatest' | 'list' | 'persist'>,
  ) {}

  async getLatest(orgId: string, projectId: string, findingId: string) {
    await this.assertFinding(orgId, projectId, findingId);
    return this.persistence.findLatest(orgId, projectId, findingId);
  }

  async getHistory(orgId: string, projectId: string, findingId: string) {
    await this.assertFinding(orgId, projectId, findingId);
    return this.persistence.list(orgId, projectId, findingId);
  }

  async generate(orgId: string, projectId: string, findingId: string, regenerate: boolean) {
    const finding = await this.assertFinding(orgId, projectId, findingId);
    if (!regenerate) {
      const existing = await this.persistence.findLatest(orgId, projectId, findingId);
      if (existing) return existing;
    }

    const bottleneck = this.toBottleneck(finding);
    if (!bottleneck) {
      throw new NotFoundException('Finding does not contain an RCA-supported bottleneck');
    }

    try {
      const result = await this.orchestrator.analyze(projectId, bottleneck);
      const evidence = buildRcaEvidence(projectId, bottleneck);
      return this.persistence.persist({
        orgId,
        projectId,
        findingId,
        evidence,
        analysis,
        provider: process.env.SOONWHY_RCA_PROVIDER ?? 'openai-compatible',
        model: process.env.SOONWHY_RCA_MODEL ?? 'unknown',
        promptVersion: RCA_PROMPT_VERSION,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'RCA provider is not configured') {
        throw new ServiceUnavailableException('RCA provider is not configured');
      }
      throw error;
    }
  }

  private async assertFinding(orgId: string, projectId: string, findingId: string) {
    const finding = await this.repository.findFinding(orgId, projectId, findingId);
    if (!finding) throw new NotFoundException('Finding not found');
    return finding;
  }

  private toBottleneck(finding: Awaited<ReturnType<RcaAnalysisRepository['findFinding']>>): CorrelatedBottleneck | null {
    if (!finding || finding.type !== 'bottleneck') return null;
    const evidence = finding.evidence;
    const correlated = evidence.find((item) => item.label === 'correlated-signal');
    if (!correlated) return null;

    const latencyId = String(correlated.context?.sourceFindingId ?? '');
    if (!latencyId) return null;

    const guidance = evidence.find((item) => item.label === 'optimization-guidance');
    const supportingFindings = evidence
      .filter((item) => item.label === 'supporting-finding')
      .map((item) => ({
        id: String(item.context?.findingId ?? ''),
        projectId: finding.projectId,
        serviceName: finding.serviceName,
        type: String(item.context?.findingType ?? 'latency') as CorrelatedBottleneck['supportingFindings'][number]['type'],
        severity: String(item.context?.severity ?? 'warning') as 'warning' | 'critical',
        title: String(item.context?.findingType ?? 'Supporting finding'),
        description: '',
        observedValue: Number(item.value),
        threshold: 0,
        unit: 'unknown',
        window: { start: finding.windowStart, end: finding.windowEnd },
        evidence: [item],
      }));

    return {
      serviceName: finding.serviceName,
      latency: {
        id: latencyId,
        projectId: finding.projectId,
        serviceName: finding.serviceName,
        type: 'latency',
        severity: finding.severity as 'warning' | 'critical',
        title: 'Correlated latency',
        description: finding.description,
        observedValue: finding.observedValue,
        threshold: finding.threshold,
        unit: finding.unit,
        window: { start: finding.windowStart, end: finding.windowEnd },
        evidence: [correlated],
      },
      supportingFindings,
      recommendation: String(guidance?.value ?? ''),
      dependencyType: typeof guidance?.context?.dependencyType === 'string'
        ? guidance.context.dependencyType
        : undefined,
      dependencyName: typeof guidance?.context?.dependencyName === 'string'
        ? guidance.context.dependencyName
        : undefined,
      traceIds: evidence
        .filter((item) => item.label === 'correlated-trace')
        .map((item) => String(item.value)),
    };
  }
}
