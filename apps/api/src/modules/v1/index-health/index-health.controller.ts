import { Controller, Get, UseGuards } from "@nestjs/common";
import { PlatformAdminGuard } from "../../../common/guards/platform-admin.guard";
import { IndexHealthService } from "./index-health.service";

@UseGuards(PlatformAdminGuard)
@Controller("admin/index-health")
export class IndexHealthController {
  constructor(private readonly service: IndexHealthService) {}

  @Get()
  snapshot() {
    return this.service.snapshot();
  }
}
