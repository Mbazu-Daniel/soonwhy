import type { DetectionFinding } from "./detection.types";

export interface DeploymentInfo {
  deploymentId: string;
  version: string;
  deployedAt: Date;
  serviceName: string;
}

export interface CorrelatedBottleneck {
  serviceName: string;
  latency: DetectionFinding;
  supportingFindings: DetectionFinding[];
  recommendation: string;
  dependencyType?: string;
  dependencyName?: string;
  traceIds: string[];
  deployment?: DeploymentInfo;
}
