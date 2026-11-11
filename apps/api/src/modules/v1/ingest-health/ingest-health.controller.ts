import { Controller, Get, UseGuards } from "@nestjs/common";
import { IngestHealthService } from "./ingest-health.service";
import { PlatformAdminGuard } from "../../../common/guards/platform-admin.guard";

@UseGuards(PlatformAdminGuard)
@Controller("admin/ingest-health")
export class IngestHealthController {
  constructor(private readonly health: IngestHealthService) {}

  @Get("stats")
  getStats() {
    return this.health.getSnapshot();
  }
}
