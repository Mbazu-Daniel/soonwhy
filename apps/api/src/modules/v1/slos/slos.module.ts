import { Module } from "@nestjs/common";
import { SlosController } from "./slos.controller";
import { SlosService } from "./slos.service";
import { SlosRepository } from "./slos.repository";
import { AlertModule } from "../alert/alert.module";
import { MetricsModule } from "../metrics/metrics.module";

@Module({
  imports: [MetricsModule, AlertModule],
  controllers: [SlosController],
  providers: [SlosService, SlosRepository],
  exports: [SlosService],
})
export class SlosModule {}
