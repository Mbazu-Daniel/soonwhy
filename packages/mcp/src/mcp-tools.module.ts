import { type DynamicModule, Module, type Type } from "@nestjs/common";
import { McpErrorsTools } from "./application/mcp-errors.tools";
import { McpFindingsTools } from "./application/mcp-findings.tools";
import { McpActionsTools } from "./application/mcp-actions.tools";
import { McpTelemetryTools } from "./application/mcp-telemetry.tools";

@Module({})
export class McpToolsModule {
  static register(host: Type<unknown>): DynamicModule {
    return { module: McpToolsModule, imports: [host], providers: [McpErrorsTools, McpTelemetryTools, McpFindingsTools, McpActionsTools] };
  }
}
