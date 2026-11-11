import type { TelemetryIdentity } from "@soonwhy/shared";

export type RecommendationCategory =
  | "performance"
  | "database"
  | "dependency"
  | "infrastructure"
  | "ai"
  | "error"
  | "architecture"
  | "security";

export type RecommendationPriority = "low" | "medium" | "high" | "critical";

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  description: string;
  impact: string;
  effort: "quick" | "moderate" | "significant";
  expectedSignal: ExpectedSignal;
  evidence: EvidenceReference[];
  confidence: number;
  relatedFindings: string[];
  createdAt: string;
}

export interface ExpectedSignal {
  metric: string;
  before: string;
  after: string;
  improvement: string;
}

export interface EvidenceReference {
  findingId: string;
  findingType: string;
  excerpt: string;
}

export interface RecommendationRequest {
  findings: Finding[];
  context?: {
    deploymentId?: string;
    serviceName?: string;
    endpoint?: string;
    timeWindow?: {
      start: string;
      end: string;
    };
  };
}

export interface Finding {
  identity: TelemetryIdentity;
  findingType: string;
  severity: "info" | "warning" | "critical";
  evidence: string[];
  confidence: number;
}

export interface RecommendationSet {
  recommendations: Recommendation[];
  summary: {
    total: number;
    byPriority: Record<RecommendationPriority, number>;
    byCategory: Record<RecommendationCategory, number>;
  };
  generatedAt: string;
}
