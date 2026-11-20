import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Response } from "express";
import { LogsService } from "../application/logs.service";
import { exportLogsSchema, getContextSchema, getFieldValuesSchema, getLogsSchema } from "../domain/dto";
import {
  CurrentOrg,
  OrgContext,
} from "../../../../../common/decorators/current-org.decorator";
import { AuditSearch, SearchAuditInterceptor } from "../../../platform/search-audit";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";

@UseGuards(TenantGuard)
@UseInterceptors(SearchAuditInterceptor)
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

  @Get("context")
  async getContext(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = getContextSchema.safeParse({ ...query, projectId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.logsService.getContext(org.orgId, parsed.data);
  }

  @AuditSearch("logs.export")
  @Get("export")
  async exportLogs(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = exportLogsSchema.safeParse({ ...query, projectId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const file = await this.logsService.exportLogs(org.orgId, parsed.data);
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    response.setHeader("Cache-Control", "no-store");
    return file.body;
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

  @AuditSearch("logs.search")
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
