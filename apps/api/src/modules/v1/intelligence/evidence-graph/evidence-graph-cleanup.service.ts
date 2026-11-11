import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EvidenceGraphRepository } from "./evidence-graph.repository";

@Injectable()
export class EvidenceGraphCleanupService {
  private readonly logger = new Logger(EvidenceGraphCleanupService.name);

  constructor(private readonly repository: EvidenceGraphRepository) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredData(): Promise<void> {
    this.logger.log("Starting expired data cleanup");

    try {
      const deletedNodes = await this.repository.deleteExpiredNodes();
      const deletedEdges = await this.repository.deleteExpiredEdges();

      this.logger.log(
        `Cleanup complete: deleted ${deletedNodes} expired nodes and ${deletedEdges} expired edges`,
      );
    } catch (error) {
      this.logger.error(`Failed to cleanup expired data: ${error}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldInvestigations(): Promise<void> {
    this.logger.log("Starting old investigations cleanup");
    // TODO: Add investigation cleanup logic
    this.logger.log("Old investigations cleanup complete");
  }
}
