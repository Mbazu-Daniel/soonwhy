import { Module } from "@nestjs/common";
import { DetectorSettingsController } from "./detector-settings.controller";
import { DetectorSettingsService } from "./detector-settings.service";

@Module({
  controllers: [DetectorSettingsController],
  providers: [DetectorSettingsService],
  exports: [DetectorSettingsService],
})
export class DetectorSettingsModule {}
