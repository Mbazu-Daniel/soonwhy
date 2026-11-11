import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

@Injectable()
export class AlertEvaluationCron {
  private readonly logger = new Logger(AlertEvaluationCron.name);
  private readonly backendUrl =
    process.env.BACKEND_URL || "http://localhost:3001";

  constructor(private readonly http: HttpService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: "alert-evaluation",
    timeZone: "UTC",
  })
  async runAlertEvaluation() {
    try {
      const projects = await this.getProjectsWithActiveRules();

      for (const { projectId, orgId } of projects) {
        try {
          await firstValueFrom(
            this.http.post(
              `${this.backendUrl}/api/v1/notifications/cron/evaluate-alerts`,
              {},
              {
                params: { projectId, orgId },
              },
            ),
          );
          this.logger.debug(`Evaluated alerts for project ${projectId}`);
        } catch (error) {
          this.logger.error(
            `Failed to evaluate alerts for project ${projectId}`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    } catch (error) {
      this.logger.error(
        "Failed to get projects with active rules",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async getProjectsWithActiveRules(): Promise<
    Array<{ projectId: string; orgId: string }>
  > {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.backendUrl}/api/v1/projects`),
      );
      return response.data?.projects || [];
    } catch {
      return [];
    }
  }
}
