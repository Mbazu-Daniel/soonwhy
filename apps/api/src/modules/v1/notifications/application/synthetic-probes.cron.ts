import { Injectable, Logger, Optional } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CronLeaseService } from "../../../../common/cron/cron-lease.service";
import { SyntheticProbesService } from "../../detection/synthetic-probes/application/synthetic-probes.service";

@Injectable()
export class SyntheticProbesCron {
  private readonly logger = new Logger(SyntheticProbesCron.name);

  constructor(
    private readonly syntheticProbes: SyntheticProbesService,
    @Optional() private readonly lease?: CronLeaseService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: "synthetic-probes",
    timeZone: "UTC",
  })
  async runSyntheticProbes() {
    if (this.lease) {
      await this.lease.runExclusive("synthetic-probes", 55_000, () => this.run());
      return;
    }
    await this.run();
  }

  private async run() {
    try {
      const result = await this.syntheticProbes.runDueProbes();
      if (result.due > 0) {
        this.logger.log(
          `Ran ${result.executed}/${result.due} due synthetic probes (${result.failed} failed)`,
        );
      }
    } catch (error) {
      this.logger.error(
        "Failed to dispatch synthetic probes",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
