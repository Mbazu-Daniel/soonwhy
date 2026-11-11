import { Injectable } from "@nestjs/common";
import { aggregateDeploymentMetrics, compareDeployments } from "./deployment-aggregator";
import type { DeploymentMetrics, DeploymentAggregation, DeploymentComparison } from "./deployment-intelligence.types";

@Injectable()
export class DeploymentIntelligenceService {
  aggregateMetrics(metrics: DeploymentMetrics[]): DeploymentAggregation {
    return aggregateDeploymentMetrics(metrics);
  }

  compareDeployments(
    before: DeploymentMetrics[],
    after: DeploymentMetrics[],
  ): DeploymentComparison {
    return compareDeployments(before, after);
  }
}
