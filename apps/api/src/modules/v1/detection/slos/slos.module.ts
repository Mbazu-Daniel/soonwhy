import { Module } from "@nestjs/common";
import { SlosController } from "./presentation/slos.controller";
import { SlosService } from "./application/slos.service";
import { SlosRepository } from "./infrastructure/slos.repository";
import { AlertModule } from "../alert/alert.module";
import { MetricsModule } from "../../telemetry/metrics/metrics.module";

@Module({
  imports: [MetricsModule, AlertModule],
  controllers: [SlosController],
  providers: [SlosService, SlosRepository],
  exports: [SlosService],
})
export class SlosModule {}
