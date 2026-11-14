import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiKeysService } from "../api-keys/api-keys.service";
import { MCP_PRINCIPAL_KEY, MCP_READ_SCOPE } from "./mcp.constants";
import type { McpAuthedRequest } from "./mcp.types";

const BEARER = /^Bearer\s+(\S+)$/i;

@Injectable()
export class McpApiKeyGuard implements CanActivate {
  constructor(@Inject(ApiKeysService) private readonly apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<McpAuthedRequest>();
    const token = BEARER.exec(request.headers.authorization ?? "")?.[1];
    if (!token) throw new UnauthorizedException("A bearer API key is required");
    const principal = await this.apiKeys.validateKey(token);
    if (!principal) throw new UnauthorizedException("Invalid or expired API key");
    if (!principal.scopes.includes(MCP_READ_SCOPE)) {
      throw new ForbiddenException(`The API key needs the ${MCP_READ_SCOPE} scope`);
    }
    request[MCP_PRINCIPAL_KEY] = principal;
    return true;
  }
}
