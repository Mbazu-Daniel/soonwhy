import { Module } from "@nestjs/common";
import { InfrastructureIntelligenceController } from "./infrastructure-intelligence.controller";
import { InfrastructureIntelligenceService } from "./infrastructure-intelligence.service";

@Module({
  controllers: [InfrastructureIntelligenceController],
  providers: [InfrastructureIntelligenceService],
  exports: [InfrastructureIntelligenceService],
})
export class InfrastructureIntelligenceModule {}
