import type { TelemetryIdentity } from "@soonwhy/shared";

export type EvidenceNodeType =
  | "deployment"
  | "service"
  | "endpoint"
  | "trace"
  | "span"
  | "error"
  | "database"
  | "dependency"
  | "infrastructure"
  | "runtime"
  | "ai_operation"
  | "log";

export type EvidenceEdgeType =
  | "causes"
  | "caused_by"
  | "correlated_with"
  | "same_trace"
  | "same_deployment"
  | "same_service"
  | "same_endpoint"
  | "spans"
  | "contains"
  | "child_of"
  | "parent_of"
  | "depends_on"
  | "affects";

export interface EvidenceNode {
  id: string;
  type: EvidenceNodeType;
  identity: TelemetryIdentity;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface EvidenceEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EvidenceEdgeType;
  strength: number; // 0-1 confidence
  metadata?: Record<string, unknown>;
}

export interface EvidenceGraph {
  nodes: Map<string, EvidenceNode>;
  edges: Map<string, EvidenceEdge>;
  indexedByTrace: Map<string, Set<string>>; // traceId -> nodeIds
  indexedByService: Map<string, Set<string>>; // serviceName -> nodeIds
  indexedByDeployment: Map<string, Set<string>>; // deploymentId -> nodeIds
}

export interface GraphPath {
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  totalStrength: number;
}

export interface GraphQuery {
  startNodeId?: string;
  startType?: EvidenceNodeType;
  endNodeId?: string;
  endType?: EvidenceNodeType;
  edgeTypes?: EvidenceEdgeType[];
  maxDepth?: number;
  minStrength?: number;
}

export interface GraphTraversalResult {
  paths: GraphPath[];
  visitedNodes: Set<string>;
  totalPaths: number;
}
