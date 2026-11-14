import { createHash } from "node:crypto";
import type { CanonicalValue } from "./telemetry-identity.types";

export const FINGERPRINT_VERSION = 1;

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

export function fingerprintTrace(traceId: string): string {
  return traceId.toLowerCase().trim();
}

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
  return route.trim();
}

function normalizeStackTrace(stackTrace: string): string {
  return stackTrace
    .split("\n")
    .map((line) => {
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
    .replace(/--[^\r\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:''|[^'])*'/g, "?")
    .replace(/"(?:""|[^"])*"/g, "?")
    .replace(/\b\d+(?:\.\d+)?\b/g, "?")
    .replace(/\bIN\s*\(([^()]*)\)/gi, "IN (?)")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return { operation };
}
