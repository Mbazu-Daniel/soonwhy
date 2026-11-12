import {
  SpanKind,
  SpanStatusCode,
  trace,
  type Span,
} from "@opentelemetry/api";
import {
  DEFAULT_IGNORED_PATHS,
  DEFAULT_IGNORED_PREFIXES,
  INSTRUMENTATION_NAME,
} from "./constants.js";
import { normalizeNextRoute } from "./normalize.js";
import type { SoonwhyRouteContext, SoonwhyRouteOptions } from "./types.js";

function pathnameFrom(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "/";
  }
}

function isDefaultIgnoredPath(pathname: string): boolean {
  return (
    (DEFAULT_IGNORED_PATHS as readonly string[]).includes(pathname) ||
    DEFAULT_IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function configureSpan(
  span: Span,
  request: Request,
  pathname: string,
  route: string,
): void {
  const method = request.method.toUpperCase();
  span.updateName(`${method} ${route}`);
  span.setAttributes({
    "http.request.method": method,
    "http.route": route,
    "url.path": pathname,
    "soonwhy.framework": "nextjs",
  });
}

export function withSoonwhy<
  Arguments extends unknown[],
  Result extends Response,
>(
  handler: (request: Request, ...args: Arguments) => Result | Promise<Result>,
  options: SoonwhyRouteOptions = {},
): (request: Request, ...args: Arguments) => Promise<Result> {
  return async (request: Request, ...args: Arguments): Promise<Result> => {
    const pathname = pathnameFrom(request);
    const context: SoonwhyRouteContext = {
      request,
      pathname,
      method: request.method,
    };
    let ignored =
      options.ignoreDefaultPaths !== false && isDefaultIgnoredPath(pathname);
    try {
      ignored ||= options.ignore?.(context) === true;
    } catch {
      ignored = true;
    }
    if (ignored) return handler(request, ...args);

    let route: string | null | undefined;
    try {
      route = options.routeResolver?.(context);
    } catch {
      route = undefined;
    }
    route = route || normalizeNextRoute(pathname);

    const execute = async (span: Span): Promise<Result> => {
      configureSpan(span, request, pathname, route);
      try {
        const response = await handler(request, ...args);
        span.setAttribute("http.response.status_code", response.status);
        if (response.status >= 500) {
          span.setStatus({ code: SpanStatusCode.ERROR });
        }
        return response;
      } catch (error) {
        span.setAttribute("http.response.status_code", 500);
        span.setStatus({ code: SpanStatusCode.ERROR });
        if (options.recordExceptions !== false && error instanceof Error) {
          span.recordException(error);
        }
        throw error;
      }
    };

    const active = trace.getActiveSpan();
    if (active?.isRecording()) return execute(active);

    return trace
      .getTracer(INSTRUMENTATION_NAME)
      .startActiveSpan(
        `${request.method.toUpperCase()} ${route}`,
        { kind: SpanKind.SERVER },
        async (span) => {
          try {
            return await execute(span);
          } finally {
            span.end();
          }
        },
      );
  };
}
