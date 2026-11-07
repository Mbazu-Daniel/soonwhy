import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { getMetricsSchema } from "./dto";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { z } from "zod";

const hostMetricsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  interval: z.string().optional(),
});

@UseGuards(TenantGuard)
@Controller("metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(
    @CurrentOrg() org: OrgContext,
    @Query() query: Record<string, unknown>,
  ) {
    const orgId = org.orgId;
    const parsed = getMetricsSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.metricsService.getMetrics(orgId, parsed.data);
  }

  @Get("host")
  async getHostMetrics(
    @CurrentOrg() org: OrgContext,
    @Query() query: Record<string, unknown>,
  ) {
    const orgId = org.orgId;
    const parsed = hostMetricsSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.metricsService.getHostMetrics(orgId, parsed.data);
  }
}
