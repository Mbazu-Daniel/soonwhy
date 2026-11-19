import { Module } from "@nestjs/common";
import { TracesController } from "./presentation/traces.controller";
import { TracesService } from "./application/traces.service";
import { TracesRepository } from "./infrastructure/traces.repository";
import { TelemetryModule } from "../../../../common/telemetry";

@Module({
  imports: [TelemetryModule],
  controllers: [TracesController],
  providers: [TracesService, TracesRepository],
  exports: [TracesService],
})
export class TracesModule {}
