import { Controller, Post, Body } from "@nestjs/common";
import { AIIntelligenceService } from "./ai-intelligence.service";
import type { AIOperation } from "./ai-intelligence.types";

@Controller("intelligence/ai")
export class AIIntelligenceController {
  constructor(private readonly aiService: AIIntelligenceService) {}

  @Post("aggregate")
  aggregate(@Body() operations: AIOperation[]) {
    return this.aiService.aggregateOperations(operations);
  }

  @Post("group-by-model")
  groupByModel(@Body() operations: AIOperation[]) {
    const grouped = this.aiService.groupByModel(operations);
    return Object.fromEntries(grouped);
  }

  @Post("group-by-type")
  groupByType(@Body() operations: AIOperation[]) {
    const grouped = this.aiService.groupByType(operations);
    return Object.fromEntries(grouped);
  }

  @Post("detect-token-spike")
  detectTokenSpike(
    @Body()
    body: {
      operations: AIOperation[];
      baselineTokensPerMinute: number;
      thresholdPercent?: number;
    },
  ) {
    return this.aiService.detectTokenSpike(
      body.operations,
      body.baselineTokensPerMinute,
      body.thresholdPercent,
    );
  }

  @Post("detect-cost-spike")
  detectCostSpike(
    @Body()
    body: {
      operations: AIOperation[];
      baselineCostPerHour: number;
      thresholdPercent?: number;
    },
  ) {
    return this.aiService.detectCostSpike(
      body.operations,
      body.baselineCostPerHour,
      body.thresholdPercent,
    );
  }

  @Post("detect-latency-regression")
  detectLatencyRegression(
    @Body()
    body: {
      operations: AIOperation[];
      baselineLatencyMs: number;
      thresholdPercent?: number;
    },
  ) {
    return this.aiService.detectLatencyRegression(
      body.operations,
      body.baselineLatencyMs,
      body.thresholdPercent,
    );
  }

  @Post("detect-provider-failure")
  detectProviderFailure(
    @Body()
    body: {
      operations: AIOperation[];
      errorRateThreshold?: number;
    },
  ) {
    return this.aiService.detectProviderFailure(
      body.operations,
      body.errorRateThreshold,
    );
  }

  @Post("detect-model-failure")
  detectModelFailure(
    @Body()
    body: {
      operations: AIOperation[];
      errorRateThreshold?: number;
    },
  ) {
    return this.aiService.detectModelFailure(
      body.operations,
      body.errorRateThreshold,
    );
  }

  @Post("detect-rate-limit")
  detectRateLimit(@Body() operations: AIOperation[]) {
    return this.aiService.detectRateLimitHits(operations);
  }

  @Post("detect-retry-loops")
  detectRetryLoops(
    @Body()
    body: {
      operations: AIOperation[];
      maxRetries?: number;
    },
  ) {
    return this.aiService.detectRetryLoops(body.operations, body.maxRetries);
  }

  @Post("detect-tool-call-failures")
  detectToolCallFailures(
    @Body()
    body: {
      operations: AIOperation[];
      errorRateThreshold?: number;
    },
  ) {
    return this.aiService.detectToolCallFailures(
      body.operations,
      body.errorRateThreshold,
    );
  }

  @Post("detect-agent-loops")
  detectAgentLoops(
    @Body()
    body: {
      operations: AIOperation[];
      maxSteps?: number;
    },
  ) {
    return this.aiService.detectAgentLoops(body.operations, body.maxSteps);
  }

  @Post("detect-retrieval-failures")
  detectRetrievalFailures(
    @Body()
    body: {
      operations: AIOperation[];
      errorRateThreshold?: number;
    },
  ) {
    return this.aiService.detectRetrievalFailures(
      body.operations,
      body.errorRateThreshold,
    );
  }
}
