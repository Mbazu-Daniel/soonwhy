import { UnauthorizedException } from "@nestjs/common";
import type { McpContext } from "@nestjs/mcp";
import { MCP_PRINCIPAL_KEY } from "./mcp.constants";
import type { McpAuthedRequest, McpPrincipal } from "./mcp.types";

export function principalOf(context: McpContext<McpAuthedRequest>): McpPrincipal {
  const principal = context.request?.[MCP_PRINCIPAL_KEY];
  if (!principal) throw new UnauthorizedException("Missing MCP principal");
  return principal;
}
