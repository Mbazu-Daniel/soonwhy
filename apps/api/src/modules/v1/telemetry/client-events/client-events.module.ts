import { Module } from "@nestjs/common";
import { ClientEventsController } from "./presentation/client-events.controller";
import { ClientEventsService } from "./application/client-events.service";
import { TelemetryModule } from "../../../../common/telemetry";
import { ApiKeysModule } from "../../identity/api-keys/api-keys.module";

@Module({
  imports: [TelemetryModule, ApiKeysModule],
  controllers: [ClientEventsController],
  providers: [ClientEventsService],
  exports: [ClientEventsService],
})
export class ClientEventsModule {}
