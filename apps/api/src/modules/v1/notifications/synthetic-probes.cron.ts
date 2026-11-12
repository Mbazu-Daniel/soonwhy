import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SyntheticProbesService } from "../synthetic-probes/synthetic-probes.service";

@Injectable()
export class SyntheticProbesCron {
  private readonly logger = new Logger(SyntheticProbesCron.name);

  constructor(private readonly syntheticProbes: SyntheticProbesService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: "synthetic-probes",
    timeZone: "UTC",
  })
  async runSyntheticProbes() {
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
