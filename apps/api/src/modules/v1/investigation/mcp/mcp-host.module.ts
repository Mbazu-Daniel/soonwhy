import { Module } from "@nestjs/common";
import { MCP_ACTIONS_PORT, MCP_AUTHENTICATOR, MCP_ERRORS_PORT, MCP_FINDINGS_PORT, MCP_HOST_TOKENS, MCP_RCA_PORT, MCP_TELEMETRY_PORT } from "@soonwhy/mcp";
import { RcaModule } from "../../detection/detections/rca.module";
import { FindingsModule } from "../../detection/findings";
import { ApiKeysModule } from "../../identity/api-keys";
import { InvestigationToolsModule } from "../investigation-tools";
import { ErrorsInvestigation } from "../investigation-tools/application/errors-investigation.service";
import { FindingsInvestigation } from "../investigation-tools/application/findings-investigation.service";
import { RcaInvestigation } from "../investigation-tools/application/rca-investigation.service";
import { TelemetryInvestigation } from "../investigation-tools/application/telemetry-investigation.service";
import { McpActionsAdapter } from "./mcp-actions.adapter";
import { McpApiKeyAuthenticator } from "./mcp-api-key.authenticator";

@Module({
  imports: [ApiKeysModule, InvestigationToolsModule, FindingsModule, RcaModule],
  providers: [
    McpApiKeyAuthenticator,
    McpActionsAdapter,
    { provide: MCP_ACTIONS_PORT, useExisting: McpActionsAdapter },
    { provide: MCP_AUTHENTICATOR, useExisting: McpApiKeyAuthenticator },
    { provide: MCP_ERRORS_PORT, useExisting: ErrorsInvestigation },
    { provide: MCP_TELEMETRY_PORT, useExisting: TelemetryInvestigation },
    { provide: MCP_FINDINGS_PORT, useExisting: FindingsInvestigation },
    { provide: MCP_RCA_PORT, useExisting: RcaInvestigation },
  ],
  exports: MCP_HOST_TOKENS,
})
export class McpHostModule {}
