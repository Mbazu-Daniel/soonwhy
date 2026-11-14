import type { Request } from "express";
import type { ToolScope } from "../investigation-tools/investigation-tools.types";
import type { MCP_PRINCIPAL_KEY } from "./mcp.constants";

export interface McpPrincipal extends ToolScope {
  scopes: string[];
}

export type McpAuthedRequest = Request & {
  [K in typeof MCP_PRINCIPAL_KEY]?: McpPrincipal;
};
