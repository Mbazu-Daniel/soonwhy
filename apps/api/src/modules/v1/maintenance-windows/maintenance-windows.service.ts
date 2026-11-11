import { Injectable, Logger } from "@nestjs/common";
import { MaintenanceWindowsRepository } from "./maintenance-windows.repository";

@Injectable()
export class MaintenanceWindowsService {
  private readonly logger = new Logger(MaintenanceWindowsService.name);

  constructor(private readonly repository: MaintenanceWindowsRepository) {}

  async createMaintenanceWindow(data: {
    orgId: string;
    projectId: string;
    name: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    affectedServices?: string[];
    affectedAlertRules?: string[];
    recurringSchedule?: Record<string, unknown>;
  }) {
    return this.repository.createMaintenanceWindow(data);
  }

  async getMaintenanceWindows(
    orgId: string,
    projectId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    return this.repository.getMaintenanceWindows(orgId, projectId, limit, offset);
  }

  async getActiveMaintenanceWindows(
    orgId: string,
    projectId: string,
    timestamp: Date = new Date(),
  ) {
    return this.repository.getActiveMaintenanceWindows(orgId, projectId, timestamp);
  }

  async updateMaintenanceWindow(
    id: number,
    data: {
      name?: string;
      description?: string;
      startTime?: Date;
      endTime?: Date;
      isActive?: boolean;
      affectedServices?: string[];
      affectedAlertRules?: string[];
      recurringSchedule?: Record<string, unknown>;
    },
  ) {
    return this.repository.updateMaintenanceWindow(id, data);
  }

  async deleteMaintenanceWindow(id: number) {
    await this.repository.deleteMaintenanceWindow(id);
  }

  async isAlertSuppressed(
    orgId: string,
    projectId: string,
    alertRuleId: string,
    serviceName?: string,
    timestamp: Date = new Date(),
  ): Promise<boolean> {
    const suppressed = await this.repository.isAlertSuppressed(
      orgId,
      projectId,
      alertRuleId,
      serviceName,
      timestamp,
    );

    if (suppressed) {
      this.logger.log(
        `Alert ${alertRuleId} suppressed due to maintenance window`,
      );
    }

    return suppressed;
  }
}
