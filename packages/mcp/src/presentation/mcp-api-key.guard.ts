import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { MCP_PRINCIPAL_KEY, MCP_READ_SCOPE } from "../domain/mcp.constants";
import { MCP_AUTHENTICATOR } from "../domain/mcp.tokens";
import type { McpAuthedRequest, McpAuthenticator } from "../domain/mcp.types";

@Injectable()
export class McpApiKeyGuard implements CanActivate {
  constructor(@Inject(MCP_AUTHENTICATOR) private readonly authenticator: McpAuthenticator) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<McpAuthedRequest>();
    request[MCP_PRINCIPAL_KEY] = await this.authenticator.authenticate(request.headers.authorization as string | undefined, {
      scope: MCP_READ_SCOPE,
    });
    return true;
  }
}
