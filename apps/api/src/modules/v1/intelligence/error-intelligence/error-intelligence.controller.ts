import { Controller, Post, Body } from "@nestjs/common";
import { ErrorIntelligenceService } from "./error-intelligence.service";
import type { ErrorOccurrence, ErrorAggregation } from "./error-intelligence.types";

@Controller("intelligence/error")
export class ErrorIntelligenceController {
  constructor(private readonly service: ErrorIntelligenceService) {}

  @Post("aggregate")
  aggregateErrors(@Body() body: { occurrences: ErrorOccurrence[] }) {
    return this.service.aggregateErrors(body.occurrences);
  }

  @Post("regression")
  detectRegression(
    @Body()
    body: {
      current: ErrorAggregation;
      baseline: ErrorAggregation;
      options?: {
        frequencyThreshold?: number;
        userImpactThreshold?: number;
      };
    },
  ) {
    return this.service.detectRegression(
      body.current,
      body.baseline,
      body.options,
    );
  }

  @Post("correlate")
  correlateError(@Body() body: { occurrences: ErrorOccurrence[] }) {
    return this.service.correlateError(body.occurrences);
  }

  @Post("frequency-trend")
  detectFrequencyTrend(
    @Body()
    body: {
      occurrences: ErrorOccurrence[];
      windowMinutes?: number;
    },
  ) {
    return this.service.detectFrequencyTrend(
      body.occurrences,
      body.windowMinutes,
    );
  }

  @Post("clusters")
  detectClusters(
    @Body()
    body: {
      occurrences: ErrorOccurrence[];
      clusterWindowMs?: number;
      clusterThreshold?: number;
    },
  ) {
    return this.service.detectClusters(
      body.occurrences,
      body.clusterWindowMs,
      body.clusterThreshold,
    );
  }
}
