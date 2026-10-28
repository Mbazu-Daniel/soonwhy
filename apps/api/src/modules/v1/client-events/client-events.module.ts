import { Module } from "@nestjs/common";
import { ClientEventsController } from "./client-events.controller";
import { ClientEventsService } from "./client-events.service";
import { TelemetryModule } from "../../../common/telemetry";
import { ApiKeysModule } from "../api-keys/api-keys.module";

@Module({
  imports: [TelemetryModule, ApiKeysModule],
  controllers: [ClientEventsController],
  providers: [ClientEventsService],
  exports: [ClientEventsService],
})
export class ClientEventsModule {}
