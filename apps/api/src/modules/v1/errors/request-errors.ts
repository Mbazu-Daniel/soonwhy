import { HTTP_SERVER_ERROR_FLOOR } from "./error.constants";
import type { ErrorLogSource, RequestErrorSource } from "./error.types";

export function requestToErrorSource(request: RequestErrorSource): ErrorLogSource {
  const status = request.statusCode ?? 0;
  const target = request.route || request.url || "";
  return {
    id: request.id ?? request.eventId ?? "",
    timestamp: request.timestamp,
    service: request.service,
    environment: request.environment,
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
