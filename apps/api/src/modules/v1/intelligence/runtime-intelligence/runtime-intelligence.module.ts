import { Module } from "@nestjs/common";
import { RuntimeIntelligenceController } from "./runtime-intelligence.controller";
import { RuntimeIntelligenceService } from "./runtime-intelligence.service";

@Module({
  controllers: [RuntimeIntelligenceController],
  providers: [RuntimeIntelligenceService],
  exports: [RuntimeIntelligenceService],
})
export class RuntimeIntelligenceModule {}
