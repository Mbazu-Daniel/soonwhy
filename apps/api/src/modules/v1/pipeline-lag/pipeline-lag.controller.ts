import { Controller, Get, UseGuards } from "@nestjs/common";
import { PipelineLagService } from "./pipeline-lag.service";
import { PlatformAdminGuard } from "../../../common/guards/platform-admin.guard";

@UseGuards(PlatformAdminGuard)
@Controller("admin/pipeline-lag")
export class PipelineLagController {
  constructor(private readonly service: PipelineLagService) {}

  @Get("metrics")
  async getMetrics() {
    return this.service.getLagMetrics();
  }
}
