import { Module } from "@nestjs/common";
import { LogIntelligenceService } from "./log-intelligence.service";
import { LogIntelligenceController } from "./log-intelligence.controller";

@Module({
  controllers: [LogIntelligenceController],
  providers: [LogIntelligenceService],
  exports: [LogIntelligenceService],
})
export class LogIntelligenceModule {}
