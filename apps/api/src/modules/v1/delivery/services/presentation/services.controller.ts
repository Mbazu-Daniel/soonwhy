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
import { ServicesService } from "../application/services.service";
import { ServiceOperationsService } from "../application/service-operations.service";
import { getOperationsSchema } from "../domain/dto/get-operations.dto";
import {
  CreateServiceDto,
  UpdateServiceDto,
  type CreateServiceInput,
  type UpdateServiceInput,
} from "../domain/dto";
import {
  CurrentOrg,
  OrgContext,
} from "../../../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";

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

  @Get(":publicId/operations")
  async getServiceOperations(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("publicId") publicId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = getOperationsSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const service = await this.servicesService.getServiceById(publicId, projectId, org.orgId);
    return this.operationsService.forService({
      orgId: org.orgId,
      projectId,
      service: service.name,
      ...parsed.data,
    });
  }

  @Get(":publicId")
  async getServiceById(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("publicId") publicId: string,
  ) {
    return this.servicesService.getServiceById(publicId, projectId, org.orgId);
  }

  @Patch(":publicId")
  async updateService(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("publicId") publicId: string,
    @Body({ schema: UpdateServiceDto }) body: UpdateServiceInput,
  ) {
    return this.servicesService.updateService(publicId, projectId, org.orgId, body);
  }

  @Delete(":publicId")
  async deleteService(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("publicId") publicId: string,
  ) {
    return this.servicesService.deleteService(publicId, projectId, org.orgId);
  }
}
