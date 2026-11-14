import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { TracesService } from "./traces.service";
import { getTraceStatsSchema, getTracesSchema } from "./dto";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { AuditSearch, SearchAuditInterceptor } from "../search-audit";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";

@UseGuards(TenantGuard)
@UseInterceptors(SearchAuditInterceptor)
@Controller("projects/:projectId/traces")
export class TracesController {
  constructor(private readonly tracesService: TracesService) {}

  @AuditSearch("traces.search")
  @Get()
  async listTraces(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = getTracesSchema.safeParse({ ...query, projectId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.tracesService.listTraces(org.orgId, parsed.data);
  }

  @Get("stats")
  async getStats(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = getTraceStatsSchema.safeParse({ ...query, projectId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.tracesService.getStats(org.orgId, parsed.data);
  }

  @Get(":traceId/log-counts")
  async getSpanLogCounts(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("traceId") traceId: string,
  ) {
    return this.tracesService.getSpanLogCounts(org.orgId, projectId, traceId);
  }

  @Get(":traceId")
  async getTrace(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("traceId") traceId: string,
  ) {
    return this.tracesService.getTrace(org.orgId, projectId, traceId);
  }
}
