import { Module } from "@nestjs/common";
import { TelemetryModule } from "../../../common/telemetry";
import { ErrorsService } from "./errors.service";

@Module({
  imports: [TelemetryModule],
  providers: [ErrorsService],
  exports: [ErrorsService],
})
export class ErrorsModule {}
