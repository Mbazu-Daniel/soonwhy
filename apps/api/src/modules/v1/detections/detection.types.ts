import type { DetectionEvidence } from '../../../common/db/schema/findings';

export type FindingType = 'latency' | 'error_rate' | 'throughput' | 'dependency_latency';
export type FindingSeverity = 'warning' | 'critical';

export interface DetectionWindow {
  start: Date;
  end: Date;
}

export interface DetectionFinding {
  id: string;
  projectId: string;
  serviceName: string;
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  description: string;
  observedValue: number;
  threshold: number;
  unit: string;
  window: DetectionWindow;
  evidence: DetectionEvidence[];
}
