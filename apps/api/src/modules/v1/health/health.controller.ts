import {
  Controller,
  Get,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { HealthService } from "./health.service";
import { SKIP_ALL_THROTTLERS } from "../../../common/throttling/throttling.constants";

@ApiTags("health")
@SkipThrottle(SKIP_ALL_THROTTLERS)
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  private ok() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get()
  check() {
    return this.ok();
  }

  @Get("live")
  live() {
    return this.ok();
  }

  @Get("ready")
  async ready() {
    const report = await this.health.readiness();

    if (report.status === "degraded") {
      throw new ServiceUnavailableException(report);
    }

    return report;
  }

  @Get("dependencies")
  async dependencies() {
    return this.health.readiness();
  }
}
