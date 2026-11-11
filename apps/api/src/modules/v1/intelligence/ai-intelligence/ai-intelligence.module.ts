import { Module } from "@nestjs/common";
import { AIIntelligenceService } from "./ai-intelligence.service";
import { AIIntelligenceController } from "./ai-intelligence.controller";

@Module({
  controllers: [AIIntelligenceController],
  providers: [AIIntelligenceService],
  exports: [AIIntelligenceService],
})
export class AIIntelligenceModule {}
