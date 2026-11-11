import { Module } from "@nestjs/common";
import { AlertSuppressionRulesController } from "./alert-suppression-rules.controller";
import { AlertSuppressionRulesService } from "./alert-suppression-rules.service";

@Module({
  controllers: [AlertSuppressionRulesController],
  providers: [AlertSuppressionRulesService],
  exports: [AlertSuppressionRulesService],
})
export class AlertSuppressionRulesModule {}
