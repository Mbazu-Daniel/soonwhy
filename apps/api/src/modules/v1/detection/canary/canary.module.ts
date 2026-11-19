import { Module } from "@nestjs/common";
import { CanaryController } from "./presentation/canary.controller";
import { CanaryService } from "./application/canary.service";

@Module({
  controllers: [CanaryController],
  providers: [CanaryService],
})
export class CanaryModule {}
