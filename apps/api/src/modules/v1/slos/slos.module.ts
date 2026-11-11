import { Module } from "@nestjs/common";
import { SlosController } from "./slos.controller";
import { SlosService } from "./slos.service";
import { SlosRepository } from "./slos.repository";
import { SloAlertingService } from "./slo-alerting.service";
import { MetricsModule } from "../metrics/metrics.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { IncidentsModule } from "../incidents/incidents.module";

@Module({
  imports: [MetricsModule, NotificationsModule, IncidentsModule],
  controllers: [SlosController],
  providers: [SlosService, SlosRepository, SloAlertingService],
  exports: [SlosService, SloAlertingService],
})
export class SlosModule {}
