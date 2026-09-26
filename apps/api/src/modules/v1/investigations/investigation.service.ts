import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { DetectionEvidence } from '../../../common/db/schema/findings';
import { InvestigationRepository } from './investigation.repository';
import type {
  InvestigationGraph,
  InvestigationGraphEvidenceData,
  InvestigationGraphFindingData,
  InvestigationGraphNode,
} from './investigation.graph';

type InvestigationSnapshot = {
  finding?: InvestigationGraphFindingData;
  evidence?: DetectionEvidence[];
};

@Injectable()
export class InvestigationService {
  constructor(private readonly repository: InvestigationRepository) {}

  async list(projectId: string, orgId: string) {
    return (await this.repository.list(projectId, orgId)).map(({ investigation }) => investigation);
  }

  async getById(id: string, projectId: string, orgId: string) {
    const investigation = await this.repository.getById(id, projectId, orgId);
    if (!investigation) throw new NotFoundException('Investigation not found');
    return investigation;
  }

  async getGraph(id: string, projectId: string, orgId: string): Promise<InvestigationGraph> {
    const investigation = await this.getById(id, projectId, orgId);
    const snapshot = investigation.evidenceSnapshot as InvestigationSnapshot;

    const finding: InvestigationGraphFindingData = {
      ...(snapshot.finding ?? {}),
      id: investigation.findingId,
      serviceName: snapshot.finding?.serviceName ?? investigation.serviceName,
    };

    const findingNode: InvestigationGraphNode = {
      id: `finding:${investigation.findingId}`,
      type: 'finding',
      label: finding.title ?? investigation.title,
      data: finding,
    };

    const uniqueEvidence = new Map<string, DetectionEvidence>();
    for (const item of snapshot.evidence ?? []) {
      uniqueEvidence.set(evidenceKey(item), item);
    }

    const evidenceNodes = [...uniqueEvidence.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]): InvestigationGraphNode => {
        const data: InvestigationGraphEvidenceData = {
          kind: item.kind,
          label: item.label,
          value: item.value,
          ...(item.context ? { context: item.context } : {}),
        };

        return {
          id: `evidence:${investigation.findingId}:${encodeURIComponent(key)}`,
          type: 'evidence',
          label: item.label,
          data,
        };
      });

    return {
      investigationId: investigation.id,
      nodes: [findingNode, ...evidenceNodes],
      edges: evidenceNodes.map((node) => ({
        id: `${findingNode.id}->${node.id}`,
        source: findingNode.id,
        target: node.id,
        type: 'supported_by' as const,
      })),
    };
  }

  async start(findingId: string, projectId: string, orgId: string) {
    const finding = await this.repository.getFinding(findingId, orgId);\n    if (finding.projectId !== projectId) throw new NotFoundException('Finding not found');
    if (!finding) throw new NotFoundException('Finding not found');

    const evidence = finding.evidence as DetectionEvidence[];
    const evidenceRefs = evidence.map((item) => ({
      findingId: finding.id,
      kind: item.kind,
      label: item.label,
      value: item.value,
    }));

    try {
      return await this.repository.create({
        orgId,
        projectId: finding.projectId,
        findingId: finding.id,
        status: 'open',
        serviceName: finding.serviceName,
        title: 'Investigation for ' + finding.title,
        summary: finding.description,
        evidence: evidenceRefs,
        evidenceSnapshot: {
          finding: {
            id: finding.id,
            type: finding.type,
            severity: finding.severity,
            title: finding.title,
            description: finding.description,
            observedValue: finding.observedValue,
            threshold: finding.threshold,
            unit: finding.unit,
            windowStart: finding.windowStart.toISOString(),
            windowEnd: finding.windowEnd.toISOString(),
            detectedAt: finding.detectedAt.toISOString(),
          },
          evidence,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('An investigation is already open for this finding');
      }
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === '23505';
}

function evidenceKey(item: DetectionEvidence): string {
  return JSON.stringify([
    item.kind,
    item.label,
    item.value,
    item.context ?? null,
  ]);
}
