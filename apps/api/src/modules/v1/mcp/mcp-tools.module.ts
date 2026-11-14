import { Module } from "@nestjs/common";
import { InvestigationToolsModule } from "../investigation-tools";
import { McpErrorsTools } from "./mcp-errors.tools";
import { McpFindingsTools } from "./mcp-findings.tools";
import { McpTelemetryTools } from "./mcp-telemetry.tools";

@Module({
  imports: [InvestigationToolsModule],
  providers: [McpErrorsTools, McpTelemetryTools, McpFindingsTools],
})
export class McpToolsModule {}
