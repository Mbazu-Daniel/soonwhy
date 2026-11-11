import { Module } from "@nestjs/common";
import { DependencyIntelligenceController } from "./dependency-intelligence.controller";
import { DependencyIntelligenceService } from "./dependency-intelligence.service";

@Module({
  controllers: [DependencyIntelligenceController],
  providers: [DependencyIntelligenceService],
  exports: [DependencyIntelligenceService],
})
export class DependencyIntelligenceModule {}
