import type { FindingCategory } from "../../../../../common/db/schema/finding-lifecycle";
import type { DetectionEvidence } from "../../../../../common/db/schema/findings";

export type RaisedFinding = {
  orgId: string;
  projectId: string;
  serviceName: string;
  type: string;
  key?: string;
  category?: FindingCategory;
  recommendation?: string | null;
  severity: "warning" | "critical";
  title: string;
  description: string;
  observedValue: number;
  threshold: number;
  unit: string;
  windowStart: Date;
  windowEnd: Date;
  evidence: DetectionEvidence[];
};
