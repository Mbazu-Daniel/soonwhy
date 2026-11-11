import { Module } from "@nestjs/common";
import { QueryIntelligenceController } from "./query-intelligence.controller";
import { QueryIntelligenceService } from "./query-intelligence.service";

@Module({
  controllers: [QueryIntelligenceController],
  providers: [QueryIntelligenceService],
  exports: [QueryIntelligenceService],
})
export class QueryIntelligenceModule {}
