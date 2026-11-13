import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { SKIP_ALL_THROTTLERS } from "../throttling/throttling.constants";

@ApiTags("status")
@SkipThrottle(SKIP_ALL_THROTTLERS)
@Controller()
export class RootController {
  @Get()
  @ApiOperation({ summary: "Service status and discovery" })
  status() {
    return {
      service: "soonwhy-api",
      status: "ok",
      health: "/api/v1/health/ready",
      docs: "/docs",
    };
  }
}
