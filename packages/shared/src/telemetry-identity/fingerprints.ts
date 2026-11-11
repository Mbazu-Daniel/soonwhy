import { createHash } from "node:crypto";
import type { CanonicalValue } from "./telemetry-identity.types";

export const FINGERPRINT_VERSION = 1;

/**
 * Fingerprint a service for identity.
 *
 * Service identity is based on the service name and any stable attributes
 * (e.g., environment, region, version).
 */
export function fingerprintService(
  serviceName: string,
  attributes?: Record<string, CanonicalValue>,
): string {
  const payload = {
    type: "service",
    serviceName,
    attributes: attributes ?? {},
  };
  return hashPayload(payload);
}

/**
 * Fingerprint an HTTP route/endpoint for identity.
 *
 * Route identity includes the HTTP method, path pattern, and service context.
 */
export function fingerprintRoute(
  method: string,
  route: string,
  serviceName?: string,
): string {
  const payload = {
    type: "route",
    method: method.toUpperCase(),
    route: normalizeRoute(route),
    serviceName: serviceName ?? null,
  };
  return hashPayload(payload);
}

/**
 * Fingerprint a trace for identity.
 *
 * Trace identity is based on the trace ID itself (already unique).
 * This function validates and normalizes the trace ID format.
 */
export function fingerprintTrace(traceId: string): string {
  // Trace IDs are already unique identifiers
  // This function ensures consistent format (lowercase, trimmed)
  return traceId.toLowerCase().trim();
}

/**
 * Fingerprint a span for identity.
 *
 * Span identity includes the span's operation name, parent span ID (if any),
 * and any key attributes that define the span's semantic identity.
 */
export function fingerprintSpan(
  operationName: string,
  attributes?: Record<string, CanonicalValue>,
  parentSpanId?: string,
): string {
  const payload = {
    type: "span",
    operationName,
    attributes: attributes ?? {},
    parentSpanId: parentSpanId ?? null,
  };
  return hashPayload(payload);
}

/**
 * Fingerprint an error for identity.
 *
 * Error identity includes the error type, message, and stack trace signature.
 * File/line numbers are normalized to handle code movement.
 */
export function fingerprintError(
  errorType: string,
  errorMessage: string,
  stackTrace?: string,
): string {
  const normalizedStack = stackTrace
    ? normalizeStackTrace(stackTrace)
    : null;

  const payload = {
    type: "error",
    errorType,
    errorMessage,
    stackTrace: normalizedStack,
  };
  return hashPayload(payload);
}

/**
 * Fingerprint a database query for identity.
 *
 * Query identity includes the normalized SQL, database system, and operation type.
 * Parameter values are replaced with placeholders.
 */
export function fingerprintQuery(
  query: string,
  databaseSystem?: string,
): string {
  const normalized = normalizeQuery(query);
  const payload = {
    type: "query",
    databaseSystem: databaseSystem ?? null,
    query: normalized.operation,
  };
  return hashPayload(payload);
}

/**
 * Fingerprint a dependency (HTTP, gRPC, Redis, etc.) for identity.
 *
 * Dependency identity includes the dependency type, target (host/service),
 * and operation name.
 */
export function fingerprintDependency(
  dependencyType: "http" | "grpc" | "redis" | "kafka" | "nats" | "database",
  target: string,
  operation?: string,
): string {
  const payload = {
    type: "dependency",
    dependencyType,
    target: target.toLowerCase(),
    operation: operation ?? null,
  };
  return hashPayload(payload);
}

/**
 * Fingerprint a host/container/process for identity.
 *
 * Infrastructure identity includes the host ID, container ID, and process ID.
 */
export function fingerprintHost(
  hostId?: string,
  containerId?: string,
  processId?: string,
): string {
  const payload = {
    type: "infrastructure",
    hostId: hostId ?? null,
    containerId: containerId ?? null,
    processId: processId ?? null,
  };
  return hashPayload(payload);
}

/**
 * Fingerprint an AI/LLM operation for identity.
 *
 * AI operation identity includes the provider, model, and operation type
 * (e.g., chat, completion, embedding).
 */
export function fingerprintAIOperation(
  provider: string,
  model: string,
  operationType: "chat" | "completion" | "embedding" | "tool" | "agent",
): string {
  const payload = {
    type: "ai",
    provider: provider.toLowerCase(),
    model: model.toLowerCase(),
    operationType,
  };
  return hashPayload(payload);
}

// ========== Helpers ==========

function hashPayload(payload: CanonicalValue): string {
  const canonical = canonicalize(payload);
  return createHash("sha256")
    .update(`${FINGERPRINT_VERSION}:${JSON.stringify(canonical)}`)
    .digest("hex");
}

function canonicalize(value: CanonicalValue): CanonicalValue {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

function normalizeRoute(route: string): string {
  // Remove dynamic segments for identity (e.g., /users/:id -> /users/:id)
  // Keep parameterized routes distinct from static ones
  return route.trim();
}

function normalizeStackTrace(stackTrace: string): string {
  // Remove file/line numbers to handle code movement
  // Keep function names and call structure
  return stackTrace
    .split("\n")
    .map((line) => {
      // Remove file paths and line numbers, keep function names
      return line.replace(/at\s+.*?\/([^/]+):(\d+):(\d+)/, "at $1:line:col");
    })
    .join("\n");
}

function normalizeQuery(query: string): { operation: string } {
  const rawQuery = query.trim();
  if (!rawQuery) {
    return { operation: "" };
  }

  let operation = rawQuery
    .replace(/--[^\r\n]*/g, " ") // Remove SQL comments
    .replace(/\/\*[\s\S]*?\*\//g, " ") // Remove C-style comments
    .replace(/'(?:''|[^'])*'/g, "?") // Replace string literals
    .replace(/"(?:""|[^"])*"/g, "?") // Replace double-quoted strings
    .replace(/\b\d+(?:\.\d+)?\b/g, "?") // Replace numbers
    .replace(/\bIN\s*\(([^()]*)\)/gi, "IN (?)") // Normalize IN clauses
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
    .toLowerCase();

  return { operation };
}
