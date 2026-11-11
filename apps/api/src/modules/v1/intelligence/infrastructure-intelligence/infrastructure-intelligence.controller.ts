import { Controller, Post, Body } from "@nestjs/common";
import { InfrastructureIntelligenceService } from "./infrastructure-intelligence.service";
import type { InfrastructureMetrics } from "./infrastructure-intelligence.types";

@Controller("intelligence/infrastructure")
export class InfrastructureIntelligenceController {
  constructor(private readonly service: InfrastructureIntelligenceService) {}

  @Post("aggregate")
  aggregateMetrics(@Body() body: { metrics: InfrastructureMetrics[] }) {
    return this.service.aggregateMetrics(body.metrics);
  }
}
