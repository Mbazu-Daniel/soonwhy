import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Query,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
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
    return this.service.createOrUpdateIngestLimits({
      orgId: org.orgId,
      projectId,
      maxEventsPerSecond: (body as any).maxEventsPerSecond,
      maxBytesPerSecond: (body as any).maxBytesPerSecond,
      backpressureEnabled: (body as any).backpressureEnabled,
      backpressureStrategy: (body as any).backpressureStrategy,
      sampleRate: (body as any).sampleRate,
      traceSampleRate: (body as any).traceSampleRate,
      metricSampleRate: (body as any).metricSampleRate,
      logSampleRate: (body as any).logSampleRate,
      serviceSamplingConfig: (body as any).serviceSamplingConfig,
      alertOnLimitExceeded: (body as any).alertOnLimitExceeded,
    });
  }

  @Get("check")
  async shouldAcceptTelemetry(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("currentEventsPerSecond") currentEventsPerSecond: string,
    @Query("signalType") signalType?: string,
    @Query("serviceName") serviceName?: string,
  ) {
    return this.service.shouldAcceptTelemetry(
      org.orgId,
      projectId,
      parseFloat(currentEventsPerSecond) || 0,
      signalType as "trace" | "metric" | "log" | undefined,
      serviceName,
    );
  }
}

// Internal endpoint without tenant guard for ingest package
@Controller("internal/ingest-limits")
export class InternalIngestLimitsController {
  constructor(private readonly service: IngestLimitsService) {}

  @Get("check")
  async checkIngestLimits(
    @Query("orgId") orgId: string,
    @Query("projectId") projectId: string,
    @Query("currentEventsPerSecond") currentEventsPerSecond: string,
    @Query("signalType") signalType?: string,
    @Query("serviceName") serviceName?: string,
  ) {
    return this.service.shouldAcceptTelemetry(
      orgId,
      projectId,
      parseFloat(currentEventsPerSecond) || 0,
      signalType as "trace" | "metric" | "log" | undefined,
      serviceName,
    );
  }
}
