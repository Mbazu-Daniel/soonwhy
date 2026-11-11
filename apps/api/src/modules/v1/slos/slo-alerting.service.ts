import { Injectable, Logger } from "@nestjs/common";
import { slos, sloComplianceSnapshots } from "../../../common/db/schema";
import { db } from "../../../common/db";
import { eq, and, gt, lt, desc } from "drizzle-orm";
import { NotificationService } from "../notifications/notification.service";
import { IncidentsService } from "../incidents/incidents.service";

interface SLOAlertThreshold {
  errorBudgetPercent: number; // 0-100
  burnRateThreshold: number; // events per hour
  windowMinutes: number;
}

@Injectable()
export class SloAlertingService {
  private readonly logger = new Logger(SloAlertingService.name);

  // Default alert thresholds
  private readonly thresholds: SLOAlertThreshold[] = [
    { errorBudgetPercent: 10, burnRateThreshold: 100, windowMinutes: 60 }, // Critical: 10% budget, 100 events/hr
    { errorBudgetPercent: 25, burnRateThreshold: 50, windowMinutes: 60 }, // Warning: 25% budget, 50 events/hr
    { errorBudgetPercent: 50, burnRateThreshold: 20, windowMinutes: 60 }, // Info: 50% budget, 20 events/hr
  ];

  constructor(
    private readonly notificationService: NotificationService,
    private readonly incidentsService: IncidentsService,
  ) {}

  async checkSLOAlerts(orgId: string, projectId: string) {
    const activeSLOs = await db
      .select()
      .from(slos)
      .where(
        and(
          eq(slos.orgId, orgId),
          eq(slos.projectId, projectId),
          eq(slos.isActive, true),
        ),
      );

    for (const slo of activeSLOs) {
      await this.checkSingleSLO(slo);
    }
  }

  private async checkSingleSLO(slo: any) {
    // Get latest compliance snapshot
    const [latestSnapshot] = await db
      .select()
      .from(sloComplianceSnapshots)
      .where(eq(sloComplianceSnapshots.sloId, slo.id))
      .orderBy(desc(sloComplianceSnapshots.timestamp))
      .limit(1);

    if (!latestSnapshot) {
      return;
    }

    const errorBudgetPercent = latestSnapshot.errorBudgetRemaining || 0;

    // Check each threshold
    for (const threshold of this.thresholds) {
      if (errorBudgetPercent <= threshold.errorBudgetPercent) {
        // Calculate burn rate
        const burnRate = await this.calculateBurnRate(
          slo.id,
          threshold.windowMinutes,
        );

        if (burnRate >= threshold.burnRateThreshold) {
          await this.triggerSLOAlert(slo, errorBudgetPercent, burnRate, threshold);
        }
      }
    }
  }

  private async calculateBurnRate(sloId: number, windowMinutes: number): Promise<number> {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const snapshots = await db
      .select()
      .from(sloComplianceSnapshots)
      .where(
        and(
          eq(sloComplianceSnapshots.sloId, sloId),
          gt(sloComplianceSnapshots.timestamp, windowStart),
        ),
      );

    if (snapshots.length < 2) {
      return 0;
    }

    // Calculate error budget burn rate (error budget consumption rate)
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    
    if (!first || !last) {
      return 0;
    }
    
    const budgetChange = (first.errorBudgetRemaining || 0) - (last.errorBudgetRemaining || 0);
    const timeDiffMinutes = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (60 * 1000);

    if (timeDiffMinutes <= 0) {
      return 0;
    }

    return (budgetChange / timeDiffMinutes) * 60; // per hour
  }

  private async triggerSLOAlert(
    slo: any,
    errorBudgetPercent: number,
    burnRate: number,
    threshold: SLOAlertThreshold,
  ) {
    const severity = this.getSeverity(threshold.errorBudgetPercent);
    const title = `SLO Alert: ${slo.name} - Error Budget at ${errorBudgetPercent.toFixed(1)}%`;
    const body = `SLO "${slo.name}" is at risk. Error budget remaining: ${errorBudgetPercent.toFixed(1)}%. Burn rate: ${burnRate.toFixed(2)}/hr. Target: ${slo.targetPercentage}% over ${slo.period}.`;

    // TODO: Check if incident already exists to avoid duplicates
    // TODO: Create incident using IncidentsService
    // TODO: Send notification using NotificationService

    this.logger.warn(`SLO alert triggered for ${slo.name}: ${errorBudgetPercent.toFixed(1)}% budget remaining`);
  }

  private getSeverity(errorBudgetPercent: number): string {
    if (errorBudgetPercent <= 10) return "critical";
    if (errorBudgetPercent <= 25) return "high";
    if (errorBudgetPercent <= 50) return "medium";
    return "low";
  }

  async getSLOAlerts(orgId: string, projectId: string) {
    const sloIds = await db
      .select({ id: slos.id, name: slos.name })
      .from(slos)
      .where(
        and(
          eq(slos.orgId, orgId),
          eq(slos.projectId, projectId),
          eq(slos.isActive, true),
        ),
      );

    const alerts = [];

    for (const slo of sloIds) {
      const [latestSnapshot] = await db
        .select()
        .from(sloComplianceSnapshots)
        .where(eq(sloComplianceSnapshots.sloId, slo.id))
        .orderBy(desc(sloComplianceSnapshots.timestamp))
        .limit(1);

      if (latestSnapshot) {
        const errorBudgetPercent = latestSnapshot.errorBudgetRemaining || 0;
        const burnRate = await this.calculateBurnRate(slo.id, 60);

        for (const threshold of this.thresholds) {
          if (errorBudgetPercent <= threshold.errorBudgetPercent && burnRate >= threshold.burnRateThreshold) {
            alerts.push({
              sloId: slo.id,
              sloName: slo.name,
              errorBudgetPercent,
              burnRate,
              severity: this.getSeverity(errorBudgetPercent),
              threshold: threshold.errorBudgetPercent,
            });
            break;
          }
        }
      }
    }

    return alerts;
  }
}
