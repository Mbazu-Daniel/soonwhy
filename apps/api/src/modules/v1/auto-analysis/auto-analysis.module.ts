import { Module } from "@nestjs/common";
import { CronLeaseModule } from "../../../common/cron/cron-lease.module";
import { ErrorsModule } from "../errors";
import { NotificationsModule } from "../notifications/notifications.module";
import { RcaModule } from "../detections/rca.module";
import { AutoAnalysisController } from "./auto-analysis.controller";
import { AutoAnalysisCron } from "./auto-analysis.cron";
import { AutoAnalysisService } from "./auto-analysis.service";

@Module({
  imports: [ErrorsModule, RcaModule, NotificationsModule, CronLeaseModule],
  controllers: [AutoAnalysisController],
  providers: [AutoAnalysisService, AutoAnalysisCron],
})
export class AutoAnalysisModule {}
