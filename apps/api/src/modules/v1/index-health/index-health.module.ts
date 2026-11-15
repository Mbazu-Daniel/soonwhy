import { Module } from "@nestjs/common";
import { QuickwitService } from "@soonwhy/shared";
import { IndexHealthController } from "./index-health.controller";
import { IndexHealthService } from "./index-health.service";

@Module({
  controllers: [IndexHealthController],
  providers: [IndexHealthService, QuickwitService],
})
export class IndexHealthModule {}
