import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Idempotent } from "@nestjs/idempotency";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import {
  CreateBusinessOperationDto,
  type CreateBusinessOperationInput,
} from "./dto/create-business-operation.dto";
import { BusinessOperationsService } from "./business-operations.service";

@UseGuards(TenantGuard)
@Controller("business-operations")
export class BusinessOperationsController {
  constructor(private readonly service: BusinessOperationsService) {}

  @Get()
  async list(
    @CurrentOrg() org: OrgContext,
    @Query("projectId") projectId: string,
  ) {
    return this.service.list(projectId, org.orgId);
  }

  @Get(":id")
  async getById(@CurrentOrg() org: OrgContext, @Param("id") id: string) {
    return this.service.getById(id, org.orgId);
  }

  @Post()
  @Idempotent({
    ttl: 86400,
  })
  async create(
    @CurrentOrg() org: OrgContext,
    @Query("projectId") projectId: string,
    @Body({ schema: CreateBusinessOperationDto })
    body: CreateBusinessOperationInput,
  ) {
    return this.service.create(projectId, org.orgId, body);
  }
}
