import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DetectionEvidence } from "../../../common/db/schema/findings";
import type {
  InvestigationEvidenceRef,
  investigationCases,
} from "../../../common/db/schema/investigation-cases";
import { InvestigationRepository } from "./investigation.repository";
import type {
  InvestigationGraph,
  InvestigationGraphEvidenceData,
  InvestigationGraphFindingData,
  InvestigationGraphNode,
} from "./investigation.graph";

type InvestigationSnapshot = {
  finding?: InvestigationGraphFindingData;
  evidence?: DetectionEvidence[];
};

type InvestigationPayloadRow = typeof investigationCases.$inferSelect;

@Injectable()
export class InvestigationService {
  constructor(private readonly repository: InvestigationRepository) {}

  async list(projectId: string, orgId: string) {
    return (await this.repository.list(projectId, orgId))
      .filter(({ investigation }) => investigation.publicId)
      .map(({ investigation }) => toInvestigationPayload(investigation));
  }

  async getById(publicId: string, orgId: string) {
    const investigation = await this.repository.getById(publicId, orgId);
    if (!investigation) throw new NotFoundException("Investigation not found");
    return toInvestigationPayload(investigation);
  }

  async getGraph(publicId: string, orgId: string): Promise<InvestigationGraph> {
    const investigation = await this.getById(publicId, orgId);
    const snapshot = investigation.evidenceSnapshot as InvestigationSnapshot;

    const finding: InvestigationGraphFindingData = {
      ...snapshot.finding,
      id: investigation.findingId,
      serviceName: snapshot.finding?.serviceName ?? investigation.serviceName,
    };

    const findingNode: InvestigationGraphNode = {
      id: `finding:${investigation.findingId}`,
      type: "finding",
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
          type: "evidence",
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
        type: "supported_by" as const,
      })),
    };
  }

  async start(findingId: string, orgId: string) {
    const finding = await this.repository.getFinding(findingId, orgId);
    if (!finding) throw new NotFoundException("Finding not found");

    const evidence = finding.evidence as DetectionEvidence[];
    const evidenceRefs = evidence.map((item) => ({
      findingId: finding.id,
      kind: item.kind,
      label: item.label,
      value: item.value,
    }));

    try {
      const created = await this.repository.create({
        orgId,
        projectId: finding.projectId,
        findingId: finding.id,
        status: "open",
        serviceName: finding.serviceName,
        title: "Investigation for " + finding.title,
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
      return { ...created, id: created.publicId ?? created.id };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          "An investigation is already open for this finding",
        );
      }
      throw error;
    }
  }
}

function toInvestigationPayload(row: InvestigationPayloadRow) {
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt : new Date();
  const updatedAt =
    row.updatedAt instanceof Date ? row.updatedAt : createdAt;
  const snapshot = (row.evidenceSnapshot ?? {}) as InvestigationSnapshot;
  const serviceName = row.serviceName;
  const timestamp = toIso(
    snapshot.finding?.detectedAt ?? snapshot.finding?.windowEnd,
    createdAt,
  );
  const snapshotEvidence = snapshot.evidence ?? [];
  const fallbackRefs = (row.evidence ?? []) as InvestigationEvidenceRef[];
  const evidenceItems = snapshotEvidence.length ? snapshotEvidence : fallbackRefs;

  const events = [
    {
      id: `detection:${snapshot.finding?.id ?? row.findingId}`,
      kind: "detection",
      title: snapshot.finding?.title ?? row.title,
      description: snapshot.finding?.description ?? row.summary,
      timestamp,
      service: serviceName,
      ...(snapshot.finding?.severity
        ? { severity: snapshot.finding.severity }
        : {}),
      sourceId: snapshot.finding?.id ?? row.findingId,
    },
    ...evidenceItems.map((item, index) => ({
      id: `evidence:${index}:${item.kind}`,
      kind: item.kind,
      title: item.label,
      description: String(item.value),
      timestamp,
      service: serviceName,
      ...(sourceIdOf(item) ? { sourceId: sourceIdOf(item) } : {}),
    })),
  ];

  return {
    ...row,
    id: row.publicId ?? row.id,
    startedAt: createdAt,
    updatedAt,
    service: serviceName,
    events,
    evidence: evidenceItems.map((item) => ({
      label: item.label,
      value: String(item.value),
      ...(sourceIdOf(item) ? { sourceId: sourceIdOf(item) } : {}),
    })),
    changes: [] as Array<{
      id: string;
      message: string;
      author?: string;
      timestamp: string;
      service?: string;
    }>,
  };
}

function sourceIdOf(item: DetectionEvidence | InvestigationEvidenceRef) {
  const context = "context" in item ? item.context : undefined;
  return typeof context?.sourceId === "string" ? context.sourceId : undefined;
}

function toIso(value: string | undefined, fallback: Date): string {
  if (!value) return fallback.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function evidenceKey(item: DetectionEvidence): string {
  return JSON.stringify([
    item.kind,
    item.label,
    item.value,
    item.context ?? null,
  ]);
}
