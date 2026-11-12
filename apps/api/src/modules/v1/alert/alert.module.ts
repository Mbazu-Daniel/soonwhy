import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { IncidentsModule } from "../incidents/incidents.module";
import { AlertService } from "./alert.service";
import { SuppressionRulesController } from "./suppression-rules.controller";
import { SuppressionRulesService } from "./suppression-rules.service";

@Module({
  imports: [NotificationsModule, IncidentsModule],
  controllers: [SuppressionRulesController],
  providers: [AlertService, SuppressionRulesService],
  exports: [AlertService, SuppressionRulesService],
})
export class AlertModule {}
