import { createHash } from "crypto";
import { ANONYMOUS_PATH } from "./throttling.constants";
import type { ThrottleRequest } from "./throttling.types";

const BEARER_PREFIX = "Bearer ";

function headerValue(
  headers: ThrottleRequest["headers"],
  name: string,
): string | undefined {
  const value = headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function credentialOf(request: ThrottleRequest): string | undefined {
  const apiKey = headerValue(request.headers, "x-api-key")?.trim();
  if (apiKey) return apiKey;

  const authorization = headerValue(request.headers, "authorization");
  if (authorization?.startsWith(BEARER_PREFIX)) {
    return authorization.slice(BEARER_PREFIX.length).trim() || undefined;
  }

  return undefined;
}

function fingerprint(credential: string): string {
  return createHash("sha256").update(credential).digest("hex");
}

function isAnonymousRoute(request: ThrottleRequest): boolean {
  return ANONYMOUS_PATH.test(request.originalUrl ?? request.url ?? "");
}

export function resolveThrottleTracker(request: ThrottleRequest): string {
  const credential = isAnonymousRoute(request) ? undefined : credentialOf(request);
  if (credential) return `credential:${fingerprint(credential)}`;

  const address = request.ip ?? request.socket?.remoteAddress ?? "unknown";
  return `address:${address}`;
}
