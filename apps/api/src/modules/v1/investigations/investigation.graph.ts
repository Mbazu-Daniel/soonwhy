export type InvestigationGraphNodeType = 'finding' | 'evidence';

export type InvestigationGraphEdgeType = 'supported_by';

export type InvestigationGraphFindingData = {
  id: string;
  type?: string;
  severity?: string;
  title?: string;
  description?: string;
  observedValue?: number;
  threshold?: number;
  unit?: string;
  windowStart?: string;
  windowEnd?: string;
  detectedAt?: string;
  serviceName?: string;
};

export type InvestigationGraphEvidenceData = {
  kind: string;
  value: number | string;
  label: string;
  context?: Record<string, unknown>;
};

export type InvestigationGraphNode =
  | {
      id: string;
      type: 'finding';
      label: string;
      data: InvestigationGraphFindingData;
    }
  | {
      id: string;
      type: 'evidence';
      label: string;
      data: InvestigationGraphEvidenceData;
    };

export type InvestigationGraphEdge = {
  id: string;
  source: string;
  target: string;
  type: InvestigationGraphEdgeType;
};

export type InvestigationGraph = {
  investigationId: string;
  nodes: InvestigationGraphNode[];
  edges: InvestigationGraphEdge[];
};
