import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { LogsService } from "./logs.service";
import { getFieldValuesSchema, getLogsSchema } from "./dto";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";

@UseGuards(TenantGuard)
@Controller("projects/:projectId/logs")
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get("histogram")
  async getHistogram(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = getLogsSchema.safeParse({ ...query, projectId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.logsService.getHistogram(org.orgId, parsed.data);
  }

  @Get("fields")
  async getFields(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = getLogsSchema.safeParse({ ...query, projectId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.logsService.getFields(org.orgId, parsed.data);
  }

  @Get("fields/values")
  async getFieldValues(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = getFieldValuesSchema.safeParse({ ...query, projectId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.logsService.getFieldValues(org.orgId, parsed.data);
  }

  @Get()
  async getLogs(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = getLogsSchema.safeParse({ ...query, projectId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.logsService.getLogs(org.orgId, parsed.data);
  }
}
