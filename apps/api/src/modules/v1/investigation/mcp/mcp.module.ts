import { Module } from "@nestjs/common";
import { SoonwhyMcpModule } from "@soonwhy/mcp";
import { McpHostModule } from "./mcp-host.module";

@Module({ imports: [SoonwhyMcpModule.register({ host: McpHostModule })] })
export class McpServerModule {}
