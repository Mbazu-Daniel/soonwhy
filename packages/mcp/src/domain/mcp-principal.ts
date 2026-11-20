import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { McpContext } from "@nestjs/mcp";
import { MCP_PRINCIPAL_KEY, MCP_WRITE_SCOPE } from "./mcp.constants";
import type { McpAuthedRequest, McpPrincipal } from "./mcp.types";

export function principalOf(context: McpContext<McpAuthedRequest>): McpPrincipal {
  const principal = context.request?.[MCP_PRINCIPAL_KEY];
  if (!principal) throw new UnauthorizedException("Missing MCP principal");
  return principal;
}

export function writerOf(context: McpContext<McpAuthedRequest>): McpPrincipal {
  const principal = principalOf(context);
  if (!principal.scopes.includes(MCP_WRITE_SCOPE)) throw new ForbiddenException("This key needs the mcp:write scope");
  return principal;
}
