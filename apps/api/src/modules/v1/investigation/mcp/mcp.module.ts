import { Module, UseGuards } from "@nestjs/common";
import { McpModule } from "@nestjs/mcp";
import { ApiKeysModule } from "../../identity/api-keys";
import { McpApiKeyGuard } from "./presentation/mcp-api-key.guard";
import { McpToolsModule } from "./mcp-tools.module";
import { MCP_INSTRUCTIONS, MCP_PATH, MCP_SERVER_NAME, MCP_SERVER_VERSION } from "./domain/mcp.constants";

@Module({
  imports: [
    McpToolsModule,
    McpModule.forRoot({
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
      title: "Soonwhy",
      instructions: MCP_INSTRUCTIONS,
      path: MCP_PATH,
      include: [McpToolsModule],
      decorators: [UseGuards(McpApiKeyGuard)],
      imports: [ApiKeysModule],
    }),
  ],
})
export class SoonwhyMcpModule {}
