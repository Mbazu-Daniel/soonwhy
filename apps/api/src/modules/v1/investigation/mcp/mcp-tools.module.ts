import { Module } from "@nestjs/common";
import { InvestigationToolsModule } from "../investigation-tools";
import { McpErrorsTools } from "./application/mcp-errors.tools";
import { McpFindingsTools } from "./application/mcp-findings.tools";
import { McpTelemetryTools } from "./application/mcp-telemetry.tools";

@Module({
  imports: [InvestigationToolsModule],
  providers: [McpErrorsTools, McpTelemetryTools, McpFindingsTools],
})
export class McpToolsModule {}
