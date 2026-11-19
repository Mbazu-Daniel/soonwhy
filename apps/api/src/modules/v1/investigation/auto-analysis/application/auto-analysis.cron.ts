import { Injectable, Optional } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CronLeaseService } from "../../../../../common/cron/cron-lease.service";
import { AUTO_ANALYSIS_CRON_NAME, AUTO_ANALYSIS_LEASE_MS } from "../domain/auto-analysis.constants";
import { AutoAnalysisService } from "./auto-analysis.service";

@Injectable()
export class AutoAnalysisCron {
  constructor(
    private readonly service: AutoAnalysisService,
    @Optional() private readonly lease?: CronLeaseService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES, { name: AUTO_ANALYSIS_CRON_NAME, timeZone: "UTC" })
  async tick(): Promise<void> {
    if (this.lease) {
      await this.lease.runExclusive(AUTO_ANALYSIS_CRON_NAME, AUTO_ANALYSIS_LEASE_MS, () => this.service.runAll());
      return;
    }
    await this.service.runAll();
  }
}
