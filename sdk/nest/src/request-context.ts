import { HttpException, type ArgumentsHost } from "@nestjs/common";
import {
  DEFAULT_ERROR_STATUS,
  HTTP_HOST_TYPE,
  MAX_CONTEXT_VALUE_LENGTH,
} from "./request-context.constants.js";
import type { CapturedRequestLike } from "./request-context.types.js";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value
    ? value.slice(0, MAX_CONTEXT_VALUE_LENGTH)
    : undefined;
}

function routeOf(request: CapturedRequestLike): string | undefined {
  return (
    text(request.route?.path) ??
    text(request.routeOptions?.url) ??
    text(request.routerPath)
  );
}

export function requestContext(
  exception: unknown,
  host: ArgumentsHost,
): Record<string, string | number> {
  if (host.getType() !== HTTP_HOST_TYPE) return {};
  const request = host.switchToHttp().getRequest<CapturedRequestLike>();
  const method = text(request?.method);
  const route = request ? routeOf(request) : undefined;
  return {
    ...(method ? { "http.request.method": method } : {}),
    ...(route ? { "http.route": route } : {}),
    "http.status_code":
      exception instanceof HttpException
        ? exception.getStatus()
        : DEFAULT_ERROR_STATUS,
  };
}
