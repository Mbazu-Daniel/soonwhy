import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { TenantGuard } from "../../../../common/middleware/tenant-context.guard";
import { InfrastructureIntelligenceService } from "./infrastructure-intelligence.service";
import type { InfrastructureMetrics } from "./infrastructure-intelligence.types";

@UseGuards(TenantGuard)
@Controller("intelligence/infrastructure")
export class InfrastructureIntelligenceController {
  constructor(private readonly service: InfrastructureIntelligenceService) {}

  @Post("aggregate")
  aggregateMetrics(@Body() body: { metrics: InfrastructureMetrics[] }) {
    return this.service.aggregateMetrics(body.metrics);
  }
}
