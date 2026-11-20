import { Inject, Injectable } from "@nestjs/common";
import type { McpAuthenticator, McpPrincipal } from "@soonwhy/mcp";
import { ApiKeyAuthenticator } from "@soonwhy/shared";
import { requireApiKey } from "../../../../common/auth/require-api-key";

@Injectable()
export class McpApiKeyAuthenticator implements McpAuthenticator {
  constructor(@Inject(ApiKeyAuthenticator) private readonly apiKeys: ApiKeyAuthenticator) {}

  async authenticate(authorization: string | undefined, options: { scope: string }): Promise<McpPrincipal> {
    const key = await requireApiKey(this.apiKeys, authorization, options);
    return { orgId: key.organizationId, projectId: key.projectId, scopes: key.scopes };
  }
}
