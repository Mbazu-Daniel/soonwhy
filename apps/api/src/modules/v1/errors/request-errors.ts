import { HTTP_SERVER_ERROR_FLOOR } from "./error.constants";
import type { ErrorLogSource, RequestErrorSource } from "./error.types";

export function requestToErrorSource(request: RequestErrorSource): ErrorLogSource {
  const status = request.statusCode ?? 0;
  const target = request.url || request.route || "";
  return {
    id: request.id ?? request.eventId ?? "",
    timestamp: request.timestamp,
    service: request.service,
    level: status >= HTTP_SERVER_ERROR_FLOOR ? "error" : "warn",
    message: `${request.method ?? ""} ${target} ${status}`.trim(),
    traceId: request.traceId,
    spanId: request.spanId,
    stackTrace: "",
    attributes: {
      "http.status_code": String(status),
      "http.method": request.method ?? "",
      "http.route": request.route ?? "",
      "http.duration_ms": String(request.duration ?? 0),
    },
  };
}

export function mergeErrorSources(
  logs: ErrorLogSource[],
  requests: ErrorLogSource[],
): ErrorLogSource[] {
  const loggedTraces = new Set(logs.flatMap((log) => (log.traceId ? [log.traceId] : [])));
  const extra = requests.filter(
    (request) => !(request.traceId && loggedTraces.has(request.traceId)),
  );
  return [...logs, ...extra].sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
}
