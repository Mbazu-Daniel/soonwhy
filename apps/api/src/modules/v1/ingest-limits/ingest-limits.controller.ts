import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { ingestLimitBodySchema, ingestLimitCheckQuerySchema } from "./dto";
import { IngestLimitsService } from "./ingest-limits.service";

@Controller("projects/:projectId/ingest-limits")
@UseGuards(TenantGuard)
export class IngestLimitsController {
  constructor(private readonly service: IngestLimitsService) {}

  @Get()
  async getIngestLimits(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.getIngestLimits(org.orgId, projectId);
  }

  @Post()
  async createOrUpdateIngestLimits(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body() body: unknown,
  ) {
    const parsed = ingestLimitBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.service.createOrUpdateIngestLimits({
      orgId: org.orgId,
      projectId,
      ...parsed.data,
    });
  }

  @Get("check")
  async shouldAcceptTelemetry(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = ingestLimitCheckQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.service.shouldAcceptTelemetry(
      org.orgId,
      projectId,
      parsed.data.currentEventsPerSecond ?? 0,
      parsed.data.signalType,
      parsed.data.serviceName,
    );
  }
}

// Internal endpoint without tenant guard for ingest package
@Controller("internal/ingest-limits")
export class InternalIngestLimitsController {
  constructor(private readonly service: IngestLimitsService) {}

  @Get("check")
  async checkIngestLimits(@Query() query: Record<string, unknown>) {
    const parsed = ingestLimitCheckQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.service.shouldAcceptTelemetry(
      parsed.data.orgId ?? "",
      parsed.data.projectId ?? "",
      parsed.data.currentEventsPerSecond ?? 0,
      parsed.data.signalType,
      parsed.data.serviceName,
    );
  }
}
