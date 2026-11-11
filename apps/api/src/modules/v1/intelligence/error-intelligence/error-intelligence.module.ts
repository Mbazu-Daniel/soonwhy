import { Module } from "@nestjs/common";
import { ErrorIntelligenceController } from "./error-intelligence.controller";
import { ErrorIntelligenceService } from "./error-intelligence.service";

@Module({
  controllers: [ErrorIntelligenceController],
  providers: [ErrorIntelligenceService],
  exports: [ErrorIntelligenceService],
})
export class ErrorIntelligenceModule {}
