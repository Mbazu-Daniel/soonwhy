import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ServicesService } from "./services.service";
import {
  CreateServiceDto,
  UpdateServiceDto,
  type CreateServiceInput,
  type UpdateServiceInput,
} from "./dto";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";

@UseGuards(TenantGuard)
@Controller("projects/:projectId/services")
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  async createService(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body({ schema: CreateServiceDto }) body: CreateServiceInput,
  ) {
    return this.servicesService.createService(projectId, org.orgId, body);
  }

  @Get("map")
  async getServiceMap(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.servicesService.getServiceMap(projectId, org.orgId);
  }

  @Get()
  async getServicesForProject(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.servicesService.getServicesForProject(projectId, org.orgId);
  }

  @Get(":id")
  async getServiceById(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
  ) {
    return this.servicesService.getServiceById(id, projectId, org.orgId);
  }

  @Patch(":id")
  async updateService(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Body({ schema: UpdateServiceDto }) body: UpdateServiceInput,
  ) {
    return this.servicesService.updateService(id, projectId, org.orgId, body);
  }

  @Delete(":id")
  async deleteService(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
  ) {
    return this.servicesService.deleteService(id, projectId, org.orgId);
  }
}
