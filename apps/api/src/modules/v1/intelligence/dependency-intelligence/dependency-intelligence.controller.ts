import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { TenantGuard } from "../../../../common/middleware/tenant-context.guard";
import { DependencyIntelligenceService } from "./dependency-intelligence.service";
import type { DependencyCall } from "./dependency-intelligence.types";

@UseGuards(TenantGuard)
@Controller("intelligence/dependency")
export class DependencyIntelligenceController {
  constructor(private readonly service: DependencyIntelligenceService) {}

  @Post("aggregate")
  aggregateCalls(@Body() body: { calls: DependencyCall[] }) {
    return this.service.aggregateCalls(body.calls);
  }
}
