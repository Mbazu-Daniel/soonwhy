import { Module } from "@nestjs/common";
import { DeploymentIntelligenceController } from "./deployment-intelligence.controller";
import { DeploymentIntelligenceService } from "./deployment-intelligence.service";

@Module({
  controllers: [DeploymentIntelligenceController],
  providers: [DeploymentIntelligenceService],
  exports: [DeploymentIntelligenceService],
})
export class DeploymentIntelligenceModule {}
