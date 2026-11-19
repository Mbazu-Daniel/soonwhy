import { Module } from "@nestjs/common";
import { HealthController } from "./presentation/health.controller";
import { HealthService } from "./application/health.service";

@Module({
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
