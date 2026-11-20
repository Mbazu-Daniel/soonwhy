import { Module } from "@nestjs/common";
import { QuickwitService } from "@soonwhy/shared";
import { IndexHealthController } from "./presentation/index-health.controller";
import { IndexHealthService } from "./application/index-health.service";

@Module({
  controllers: [IndexHealthController],
  providers: [IndexHealthService, QuickwitService],
})
export class IndexHealthModule {}
