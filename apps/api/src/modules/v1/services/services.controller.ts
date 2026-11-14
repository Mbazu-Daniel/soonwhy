import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ServicesService } from "./services.service";
import { ServiceOperationsService } from "./service-operations.service";
import { getOperationsSchema } from "./dto/get-operations.dto";
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
  constructor(
    private readonly servicesService: ServicesService,
    private readonly operationsService: ServiceOperationsService,
  ) {}

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

  @Get(":id/operations")
  async getServiceOperations(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = getOperationsSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const service = await this.servicesService.getServiceById(id, projectId, org.orgId);
    return this.operationsService.forService({
      orgId: org.orgId,
      projectId,
      service: service.name,
      ...parsed.data,
    });
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
