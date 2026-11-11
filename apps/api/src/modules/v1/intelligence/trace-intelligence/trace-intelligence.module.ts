import { Module } from "@nestjs/common";
import { TraceIntelligenceService } from "./trace-intelligence.service";
import { TraceIntelligenceController } from "./trace-intelligence.controller";

@Module({
  controllers: [TraceIntelligenceController],
  providers: [TraceIntelligenceService],
  exports: [TraceIntelligenceService],
})
export class TraceIntelligenceModule {}
