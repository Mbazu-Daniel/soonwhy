import { Injectable } from "@nestjs/common";
import type {
  AIOperation,
  AIAggregation,
  AITokenSpikeFinding,
  AICostSpikeFinding,
  AILatencyRegressionFinding,
  AIProviderFailureFinding,
  AIModelFailureFinding,
  AIRateLimitFinding,
  AIRetryLoopFinding,
  AIToolCallFailureFinding,
  AIAgentLoopFinding,
  AIRetrievalFailureFinding,
} from "./ai-intelligence.types";
import {
  aggregateAIOperations,
  groupOperationsByModel,
  groupOperationsByType,
} from "./ai-aggregator";
import {
  detectTokenSpike,
  detectCostSpike,
  detectLatencyRegression,
  detectProviderFailure,
  detectModelFailure,
  detectRateLimitHits,
  detectRetryLoops,
  detectToolCallFailures,
  detectAgentLoops,
  detectRetrievalFailures,
} from "./ai-detector";

@Injectable()
export class AIIntelligenceService {
  aggregateOperations(operations: AIOperation[]): AIAggregation {
    return aggregateAIOperations(operations);
  }

  groupByModel(operations: AIOperation[]): Map<string, AIOperation[]> {
    return groupOperationsByModel(operations);
  }

  groupByType(operations: AIOperation[]): Map<string, AIOperation[]> {
    return groupOperationsByType(operations);
  }

  detectTokenSpike(
    operations: AIOperation[],
    baselineTokensPerMinute: number,
    thresholdPercent?: number,
  ): AITokenSpikeFinding[] {
    return detectTokenSpike(operations, baselineTokensPerMinute, thresholdPercent);
  }

  detectCostSpike(
    operations: AIOperation[],
    baselineCostPerHour: number,
    thresholdPercent?: number,
  ): AICostSpikeFinding[] {
    return detectCostSpike(operations, baselineCostPerHour, thresholdPercent);
  }

  detectLatencyRegression(
    operations: AIOperation[],
    baselineLatencyMs: number,
    thresholdPercent?: number,
  ): AILatencyRegressionFinding[] {
    return detectLatencyRegression(operations, baselineLatencyMs, thresholdPercent);
  }

  detectProviderFailure(
    operations: AIOperation[],
    errorRateThreshold?: number,
  ): AIProviderFailureFinding[] {
    return detectProviderFailure(operations, errorRateThreshold);
  }

  detectModelFailure(
    operations: AIOperation[],
    errorRateThreshold?: number,
  ): AIModelFailureFinding[] {
    return detectModelFailure(operations, errorRateThreshold);
  }

  detectRateLimitHits(operations: AIOperation[]): AIRateLimitFinding[] {
    return detectRateLimitHits(operations);
  }

  detectRetryLoops(
    operations: AIOperation[],
    maxRetries?: number,
  ): AIRetryLoopFinding[] {
    return detectRetryLoops(operations, maxRetries);
  }

  detectToolCallFailures(
    operations: AIOperation[],
    errorRateThreshold?: number,
  ): AIToolCallFailureFinding[] {
    return detectToolCallFailures(operations, errorRateThreshold);
  }

  detectAgentLoops(
    operations: AIOperation[],
    maxSteps?: number,
  ): AIAgentLoopFinding[] {
    return detectAgentLoops(operations, maxSteps);
  }

  detectRetrievalFailures(
    operations: AIOperation[],
    errorRateThreshold?: number,
  ): AIRetrievalFailureFinding[] {
    return detectRetrievalFailures(operations, errorRateThreshold);
  }
}
