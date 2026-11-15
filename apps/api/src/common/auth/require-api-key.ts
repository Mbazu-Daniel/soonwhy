import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ApiKeyAuthenticator, ValidatedApiKey } from "@soonwhy/shared";

export async function requireApiKey(
  authenticator: ApiKeyAuthenticator,
  authorization: string | undefined,
  options: { scope?: string } = {},
): Promise<ValidatedApiKey> {
  const result = await authenticator.authenticate(authorization, options);
  if (result.ok) return result.key;
  if (result.reason === "scope") throw new ForbiddenException(result.message);
  throw new UnauthorizedException(result.message);
}
