import { Injectable } from "@nestjs/common";
import { aggregateErrors, detectErrorRegression, correlateError } from "./error-aggregator";
import { detectErrorFrequencyTrend, detectErrorClusters } from "./error-correlation-detector";
import type {
  ErrorOccurrence,
  ErrorAggregation,
  ErrorRegression,
  ErrorCorrelation,
} from "./error-intelligence.types";

@Injectable()
export class ErrorIntelligenceService {
  aggregateErrors(occurrences: ErrorOccurrence[]): ErrorAggregation {
    return aggregateErrors(occurrences);
  }

  detectRegression(
    current: ErrorAggregation,
    baseline: ErrorAggregation,
    options?: {
      frequencyThreshold?: number;
      userImpactThreshold?: number;
    },
  ): ErrorRegression | undefined {
    return detectErrorRegression(
      current,
      baseline,
      options?.frequencyThreshold,
      options?.userImpactThreshold,
    );
  }

  correlateError(occurrences: ErrorOccurrence[]): ErrorCorrelation {
    return correlateError(occurrences);
  }

  detectFrequencyTrend(
    occurrences: ErrorOccurrence[],
    windowMinutes?: number,
  ): "increasing" | "decreasing" | "stable" {
    return detectErrorFrequencyTrend(occurrences, windowMinutes);
  }

  detectClusters(
    occurrences: ErrorOccurrence[],
    clusterWindowMs?: number,
    clusterThreshold?: number,
  ) {
    return detectErrorClusters(occurrences, clusterWindowMs, clusterThreshold);
  }
}
