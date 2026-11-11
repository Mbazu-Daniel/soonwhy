import { Controller, Post, Body } from "@nestjs/common";
import { DependencyIntelligenceService } from "./dependency-intelligence.service";
import type { DependencyCall } from "./dependency-intelligence.types";

@Controller("intelligence/dependency")
export class DependencyIntelligenceController {
  constructor(private readonly service: DependencyIntelligenceService) {}

  @Post("aggregate")
  aggregateCalls(@Body() body: { calls: DependencyCall[] }) {
    return this.service.aggregateCalls(body.calls);
  }
}
