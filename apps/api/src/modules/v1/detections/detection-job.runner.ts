import { Injectable, Logger, BeforeApplicationShutdown } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { DetectionService } from "./detection.service";

@Injectable()
export class DetectionJobRunner implements BeforeApplicationShutdown {
  private readonly logger = new Logger(DetectionJobRunner.name);
  private running = false;
  private stopping = false;
  private current: Promise<unknown> = Promise.resolve();

  constructor(private readonly detectionService: DetectionService) {}

  @Interval(1_000)
  async runQueuedJobs() {
    if (this.running || this.stopping) return;
    this.running = true;
    try {
      this.current = this.detectionService.claimAndRunOne();
      await this.current;
    } catch (error) {
      this.logger.error(
        "Queued detection run failed",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  async beforeApplicationShutdown() {
    this.stopping = true;
    await this.current.catch(() => undefined);
  }
}
