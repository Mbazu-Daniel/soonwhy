import { Controller, Post, UseGuards } from "@nestjs/common";
import { SelfMonitoringService } from "./self-monitoring.service";
import { SuperAdminGuard } from "../../../common/guards/platform-admin.guard";

@UseGuards(SuperAdminGuard)
@Controller("admin/self-monitoring")
export class SelfMonitoringController {
  constructor(private readonly service: SelfMonitoringService) {}

  @Post("ensure-alerts")
  async ensureAlerts() {
    await this.service.ensureSelfMonitoringAlerts();
    return { message: "Self-monitoring alerts ensured" };
  }
}
