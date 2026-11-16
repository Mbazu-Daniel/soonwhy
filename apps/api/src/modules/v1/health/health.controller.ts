import {
  Controller,
  Get,
  Headers,
  ServiceUnavailableException,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { HealthService } from "./health.service";
import { SKIP_ALL_THROTTLERS } from "../../../common/throttling/throttling.constants";
import type { ReadinessReport } from "./health.types";

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
  async dependencies(@Headers("authorization") auth?: string) {
    const token = process.env.HEALTH_DETAILS_TOKEN;
    const production = process.env.NODE_ENV === "production";
    if (!token && production) {
      throw new NotFoundException();
    }
    if (token && auth !== `Bearer ${token}`) {
      throw new UnauthorizedException(
        "Set HEALTH_DETAILS_TOKEN and send it as a bearer token to inspect dependencies.",
      );
    }

    const report = await this.health.readiness();
    return stripErrorDetails(report);
  }
}

function stripErrorDetails(report: ReadinessReport): ReadinessReport {
  const strip = <T extends { error?: string }>(check: T): T => {
    const { error: _error, ...rest } = check;
    return rest as T;
  };
  return {
    ...report,
    dependencies: {
      database: strip(report.dependencies.database),
      redis: strip(report.dependencies.redis),
      quickwit: strip(report.dependencies.quickwit),
    },
  };
}
