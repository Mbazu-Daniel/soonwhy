import { Controller, Post, Body } from "@nestjs/common";
import { DeploymentIntelligenceService } from "./deployment-intelligence.service";
import type { DeploymentMetrics } from "./deployment-intelligence.types";

@Controller("intelligence/deployment")
export class DeploymentIntelligenceController {
  constructor(private readonly service: DeploymentIntelligenceService) {}

  @Post("aggregate")
  aggregateMetrics(@Body() body: { metrics: DeploymentMetrics[] }) {
    return this.service.aggregateMetrics(body.metrics);
  }

  @Post("compare")
  compareDeployments(
    @Body()
    body: {
      before: DeploymentMetrics[];
      after: DeploymentMetrics[];
    },
  ) {
    return this.service.compareDeployments(body.before, body.after);
  }
}
