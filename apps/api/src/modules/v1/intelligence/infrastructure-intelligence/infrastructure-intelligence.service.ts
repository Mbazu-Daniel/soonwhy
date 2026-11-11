import { Injectable } from "@nestjs/common";
import { aggregateInfrastructureMetrics } from "./infrastructure-aggregator";
import type { InfrastructureMetrics, InfrastructureAggregation } from "./infrastructure-intelligence.types";

@Injectable()
export class InfrastructureIntelligenceService {
  aggregateMetrics(metrics: InfrastructureMetrics[]): InfrastructureAggregation {
    return aggregateInfrastructureMetrics(metrics);
  }
}
