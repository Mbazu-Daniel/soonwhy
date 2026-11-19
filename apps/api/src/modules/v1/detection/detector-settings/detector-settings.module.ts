import { Module } from "@nestjs/common";
import { DetectorSettingsController } from "./presentation/detector-settings.controller";
import { DetectorSettingsService } from "./application/detector-settings.service";

@Module({
  controllers: [DetectorSettingsController],
  providers: [DetectorSettingsService],
  exports: [DetectorSettingsService],
})
export class DetectorSettingsModule {}
