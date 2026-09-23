import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { DetectionEvidence } from '../../../common/db/schema/findings';
import { InvestigationRepository } from './investigation.repository';

@Injectable()
export class InvestigationService {
  constructor(private readonly repository: InvestigationRepository) {}

  async list(projectId: string, orgId: string) {
    return (await this.repository.list(projectId, orgId)).map(({ investigation }) => investigation);
  }

  async getById(id: string, orgId: string) {
    const investigation = await this.repository.getById(id, orgId);
    if (!investigation) throw new NotFoundException('Investigation not found');
    return investigation;
  }

  async start(findingId: string, orgId: string) {
    const finding = await this.repository.getFinding(findingId, orgId);
    if (!finding) throw new NotFoundException('Finding not found');

    const existing = await this.repository.findOpenByFinding(findingId, orgId);
    if (existing) throw new ConflictException('An investigation is already open for this finding');

    const evidence = finding.evidence as DetectionEvidence[];
    const evidenceRefs = evidence.map((item) => ({
      findingId: finding.id,
      kind: item.kind,
      label: item.label,
      value: item.value,
    }));

    return this.repository.create({
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
  }
}
