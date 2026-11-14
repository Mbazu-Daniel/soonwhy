import { Injectable, Logger } from "@nestjs/common";
import { IncidentsRepository } from "./incidents.repository";
import { NotificationService } from "../notifications/notification.service";
import type { AlertRuleSeverity } from "../../../common/db/schema";

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly repository: IncidentsRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async createOrUpdateIncident(data: {
    incidentId: string;
    orgId: string;
    projectId: string;
    alertRuleId: string;
    severity: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await this.repository.getIncidentByIncidentId(data.incidentId);

    if (existing) {
      await this.repository.updateIncidentLastEvaluated(existing.id);
      return existing;
    }

    const incident = await this.repository.createIncident(data);
    this.logger.log(`Created incident ${data.incidentId} for alert rule ${data.alertRuleId}`);
    return incident;
  }

  async checkForRecovery(alertRuleId: string, metricData: Record<string, unknown>) {
    const activeIncidents = await this.repository.getActiveIncidentsForRule(alertRuleId);

    for (const incident of activeIncidents) {
      const metadata = incident.metadata as Record<string, unknown> | undefined;
      const operator = metadata?.operator as string;
      const threshold = metadata?.threshold as string;
      const value = metricData.value as number;

      let recovered = false;

      if (operator === "gt" && value <= Number(threshold)) {
        recovered = true;
      } else if (operator === "lt" && value >= Number(threshold)) {
        recovered = true;
      } else if (operator === "gte" && value < Number(threshold)) {
        recovered = true;
      } else if (operator === "lte" && value > Number(threshold)) {
        recovered = true;
      } else if (operator === "eq" && value === Number(threshold)) {
        recovered = true;
      } else if (operator === "neq" && value !== Number(threshold)) {
        recovered = true;
      }

      if (recovered && !incident.recoveryNotified) {
        const claimed = await this.repository.markRecoveryNotified(incident.id);
        if (!claimed) continue;
        await this.sendRecoveryNotification(incident);
        const resolved = await this.repository.resolveIncident(incident.id);
        if (resolved) {
          this.logger.log(`Resolved incident ${incident.incidentId} - condition recovered`);
        }
      }
    }
  }

  private async sendRecoveryNotification(incident: any) {
    await this.notificationService.dispatchAlert({
      orgId: incident.orgId,
      projectId: incident.projectId,
      incidentId: `recovery-${incident.incidentId}`,
      severity: "info" as AlertRuleSeverity,
      title: `Recovered: ${incident.title}`,
      body: `The alert "${incident.title}" has recovered. The condition is no longer violated.`,
      htmlBody: undefined,
      metadata: {
        originalIncidentId: incident.incidentId,
        alertRuleId: incident.alertRuleId,
        recovery: "true",
      },
    });
  }

  async acknowledgeIncident(id: number, acknowledgedBy: string, note?: string) {
    return this.repository.acknowledgeIncident(id, acknowledgedBy, note);
  }

  async resolveIncident(id: number, resolvedBy?: string, note?: string) {
    return this.repository.resolveIncident(id, resolvedBy, note);
  }

  async getIncidents(
    orgId: string,
    projectId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    return this.repository.getIncidents(orgId, projectId, limit, offset);
  }

  async getIncidentStats(orgId: string, projectId: string) {
    return this.repository.getIncidentStats(orgId, projectId);
  }
}
