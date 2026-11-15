import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { ApiKeyAuthenticator } from "@soonwhy/shared";
import { requireApiKey } from "../../../common/auth/require-api-key";
import { MCP_PRINCIPAL_KEY, MCP_READ_SCOPE } from "./mcp.constants";
import type { McpAuthedRequest } from "./mcp.types";

@Injectable()
export class McpApiKeyGuard implements CanActivate {
  constructor(@Inject(ApiKeyAuthenticator) private readonly apiKeys: ApiKeyAuthenticator) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<McpAuthedRequest>();
    const key = await requireApiKey(this.apiKeys, request.headers.authorization, { scope: MCP_READ_SCOPE });
    request[MCP_PRINCIPAL_KEY] = { orgId: key.organizationId, projectId: key.projectId, scopes: key.scopes };
    return true;
  }
}
