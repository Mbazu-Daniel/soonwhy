import { type DynamicModule, Module, type Type, UseGuards } from "@nestjs/common";
import { McpModule } from "@nestjs/mcp";
import { McpToolsModule } from "./mcp-tools.module";
import { MCP_INSTRUCTIONS, MCP_PATH, MCP_SERVER_NAME, MCP_SERVER_TITLE, MCP_SERVER_VERSION } from "./domain/mcp.constants";
import { McpApiKeyGuard } from "./presentation/mcp-api-key.guard";

export interface SoonwhyMcpOptions {
  host: Type<unknown>;
}

@Module({})
export class SoonwhyMcpModule {
  static register({ host }: SoonwhyMcpOptions): DynamicModule {
    return {
      module: SoonwhyMcpModule,
      imports: [
        McpToolsModule.register(host),
        McpModule.forRoot({
          name: MCP_SERVER_NAME,
          version: MCP_SERVER_VERSION,
          title: MCP_SERVER_TITLE,
          instructions: MCP_INSTRUCTIONS,
          path: MCP_PATH,
          include: [McpToolsModule],
          decorators: [UseGuards(McpApiKeyGuard)],
          imports: [host],
        }),
      ],
    };
  }
}
