import { Module } from "@nestjs/common";
import { CronLeaseModule } from "../../../../common/cron/cron-lease.module";
import { ErrorsModule } from "../../detection/errors";
import { NotificationsModule } from "../../notifications/notifications.module";
import { RcaModule } from "../../detection/detections/rca.module";
import { AutoAnalysisController } from "./presentation/auto-analysis.controller";
import { AutoAnalysisCron } from "./application/auto-analysis.cron";
import { AutoAnalysisService } from "./application/auto-analysis.service";

@Module({
  imports: [ErrorsModule, RcaModule, NotificationsModule, CronLeaseModule],
  controllers: [AutoAnalysisController],
  providers: [AutoAnalysisService, AutoAnalysisCron],
})
export class AutoAnalysisModule {}
