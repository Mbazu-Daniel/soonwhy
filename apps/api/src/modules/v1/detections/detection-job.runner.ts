import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { DetectionService } from "./detection.service";

@Injectable()
export class DetectionJobRunner {
  private readonly logger = new Logger(DetectionJobRunner.name);
  private running = false;

  constructor(private readonly detectionService: DetectionService) {}

  @Interval(1_000)
  async runQueuedJobs() {
    if (this.running) return;
    this.running = true;
    try {
      await this.detectionService.claimAndRunOne();
    } catch (error) {
      this.logger.error(
        "Queued detection run failed",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
