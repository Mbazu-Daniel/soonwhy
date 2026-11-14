import {
  DEFAULT_HTTP_ERROR_STATUS,
  EXPRESS_MECHANISM,
  FASTIFY_MECHANISM,
  MAX_HTTP_CONTEXT_LENGTH,
  MIN_CAPTURED_HTTP_STATUS,
} from "./http-errors.constants.js";
import type {
  ErrorCaptureTarget,
  ExpressErrorHandler,
  FastifyErrorHook,
} from "./http-errors.types.js";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value
    ? value.slice(0, MAX_HTTP_CONTEXT_LENGTH)
    : undefined;
}

export function statusOf(error: unknown): number {
  if (error && typeof error === "object") {
    const record = error as { status?: unknown; statusCode?: unknown };
    for (const candidate of [record.status, record.statusCode]) {
      if (typeof candidate === "number" && Number.isInteger(candidate)) return candidate;
    }
  }
  return DEFAULT_HTTP_ERROR_STATUS;
}

function capture(
  sdk: ErrorCaptureTarget,
  error: unknown,
  mechanism: string,
  method: unknown,
  route: unknown,
): void {
  const status = statusOf(error);
  if (status < MIN_CAPTURED_HTTP_STATUS) return;
  const verb = text(method);
  const template = text(route);
  try {
    sdk.captureError({
      error,
      attributes: {
        "exception.mechanism": mechanism,
        ...(verb ? { "http.request.method": verb } : {}),
        ...(template ? { "http.route": template } : {}),
        "http.status_code": status,
      },
    });
  } catch {
    return;
  }
}

export function expressErrorHandler(sdk: ErrorCaptureTarget): ExpressErrorHandler {
  return (error, request, _response, next) => {
    capture(sdk, error, EXPRESS_MECHANISM, request?.method, request?.route?.path);
    next(error);
  };
}

export function fastifyErrorHook(sdk: ErrorCaptureTarget): FastifyErrorHook {
  return (request, _reply, error, done) => {
    capture(sdk, error, FASTIFY_MECHANISM, request?.method, request?.routeOptions?.url);
    done();
  };
}
