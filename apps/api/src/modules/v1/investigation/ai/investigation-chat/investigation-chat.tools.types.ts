import type { ErrorsInvestigation } from "../../investigation-tools/application/errors-investigation.service";
import type { FindingsInvestigation } from "../../investigation-tools/application/findings-investigation.service";
import type { RcaInvestigation } from "../../investigation-tools/application/rca-investigation.service";
import type { TelemetryInvestigation } from "../../investigation-tools/application/telemetry-investigation.service";

export interface InvestigationServices {
  errors: ErrorsInvestigation;
  telemetry: TelemetryInvestigation;
  findings: FindingsInvestigation;
  rca: RcaInvestigation;
}
