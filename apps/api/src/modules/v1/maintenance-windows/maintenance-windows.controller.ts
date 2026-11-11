import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { MaintenanceWindowsService } from "./maintenance-windows.service";

@Controller("projects/:projectId/maintenance-windows")
@UseGuards(TenantGuard)
export class MaintenanceWindowsController {
  constructor(private readonly service: MaintenanceWindowsService) {}

  @Get()
  async getMaintenanceWindows(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.service.getMaintenanceWindows(
      org.orgId,
      projectId,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }

  @Get("active")
  async getActiveMaintenanceWindows(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.getActiveMaintenanceWindows(org.orgId, projectId);
  }

  @Post()
  async createMaintenanceWindow(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body() body: unknown,
  ) {
    return this.service.createMaintenanceWindow({
      orgId: org.orgId,
      projectId,
      name: (body as any).name,
      description: (body as any).description,
      startTime: new Date((body as any).startTime),
      endTime: new Date((body as any).endTime),
      affectedServices: (body as any).affectedServices,
      affectedAlertRules: (body as any).affectedAlertRules,
      recurringSchedule: (body as any).recurringSchedule,
    });
  }

  @Put(":id")
  async updateMaintenanceWindow(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateMaintenanceWindow(Number(id), {
      name: (body as any).name,
      description: (body as any).description,
      startTime: (body as any).startTime ? new Date((body as any).startTime) : undefined,
      endTime: (body as any).endTime ? new Date((body as any).endTime) : undefined,
      isActive: (body as any).isActive,
      affectedServices: (body as any).affectedServices,
      affectedAlertRules: (body as any).affectedAlertRules,
      recurringSchedule: (body as any).recurringSchedule,
    });
  }

  @Delete(":id")
  async deleteMaintenanceWindow(@Param("id") id: string) {
    await this.service.deleteMaintenanceWindow(Number(id));
    return { message: "Deleted" };
  }
}
