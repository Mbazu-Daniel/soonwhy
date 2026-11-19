import { Module } from "@nestjs/common";
import { DetectionModule } from "../../detection/detections";
import { RcaModule } from "../../detection/detections/rca.module";
import { ErrorsModule } from "../../detection/errors";
import { LogsModule } from "../../telemetry/logs";
import { TracesModule } from "../../telemetry/traces";
import { ErrorsInvestigation } from "./application/errors-investigation.service";
import { FindingsInvestigation } from "./application/findings-investigation.service";
import { RcaInvestigation } from "./application/rca-investigation.service";
import { TelemetryInvestigation } from "./application/telemetry-investigation.service";

@Module({
  imports: [ErrorsModule, LogsModule, TracesModule, DetectionModule, RcaModule],
  providers: [ErrorsInvestigation, TelemetryInvestigation, FindingsInvestigation, RcaInvestigation],
  exports: [ErrorsInvestigation, TelemetryInvestigation, FindingsInvestigation, RcaInvestigation],
})
export class InvestigationToolsModule {}
