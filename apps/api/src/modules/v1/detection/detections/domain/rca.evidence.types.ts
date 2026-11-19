import type { DetectionEvidence } from "../../../../../common/db/schema/findings";

export interface BottleneckEvidenceFinding {
  type: string;
  projectId: string;
  serviceName: string;
  severity: string;
  title: string;
  description: string;
  observedValue: number;
  threshold: number;
  unit: string;
  windowStart: Date;
  windowEnd: Date;
  evidence: DetectionEvidence[];
}
