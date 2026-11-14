import { Module } from "@nestjs/common";
import { DetectionModule } from "../detections";
import { RcaModule } from "../detections/rca.module";
import { ErrorsModule } from "../errors";
import { LogsModule } from "../logs";
import { TracesModule } from "../traces";
import { ErrorsInvestigation } from "./errors-investigation.service";
import { FindingsInvestigation } from "./findings-investigation.service";
import { RcaInvestigation } from "./rca-investigation.service";
import { TelemetryInvestigation } from "./telemetry-investigation.service";

@Module({
  imports: [ErrorsModule, LogsModule, TracesModule, DetectionModule, RcaModule],
  providers: [ErrorsInvestigation, TelemetryInvestigation, FindingsInvestigation, RcaInvestigation],
  exports: [ErrorsInvestigation, TelemetryInvestigation, FindingsInvestigation, RcaInvestigation],
})
export class InvestigationToolsModule {}
