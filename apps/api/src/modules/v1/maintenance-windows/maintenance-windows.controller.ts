import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import {
  createMaintenanceWindowBodySchema,
  updateMaintenanceWindowBodySchema,
} from "./dto";
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
    const parsed = createMaintenanceWindowBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.service.createMaintenanceWindow({
      orgId: org.orgId,
      projectId,
      ...parsed.data,
    });
  }

  @Put(":id")
  async updateMaintenanceWindow(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateMaintenanceWindowBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.service.updateMaintenanceWindow(Number(id), parsed.data);
  }

  @Delete(":id")
  async deleteMaintenanceWindow(@Param("id") id: string) {
    await this.service.deleteMaintenanceWindow(Number(id));
    return { message: "Deleted" };
  }
}
