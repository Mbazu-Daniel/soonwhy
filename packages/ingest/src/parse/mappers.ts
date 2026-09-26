import { randomUUID } from 'crypto';
import { nanoToMs } from './time';
import type { CaptureSettings, ParsedLogRecord, ParsedMetricPoint, ParsedSpan, TenantContext } from '../interfaces';

export type { TenantContext };

const SENSITIVE_ATTRIBUTE_PATTERN =
  /authorization|cookie|set-cookie|password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credit[_-]?card|card[_-]?number|cvv|request\.body|response\.body/i;

const SENSITIVE_TEXT_PATTERNS = [
  /(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi,
  /((?:password|passwd|token|api[_-]?key|access[_-]?key|secret|client[_-]?secret|private[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,
  /((?:cookie|set-cookie)\s*[:=]\s*)[^\n]+/gi,
];

function telemetryTimestamp(isoOrMs: string | number): string {
  const date =
    typeof isoOrMs === 'number'
      ? new Date(isoOrMs)
      : new Date(isoOrMs.includes('T') ? isoOrMs : Number(isoOrMs));
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function nanoToTelemetryTimestamp(nano: string): string {
  return telemetryTimestamp(nanoToMs(nano) || Date.now());
}

function mapMetricUnit(unit: string): 'ms' | 'count' | 'bytes' | 'percent' {
  const u = unit.toLowerCase();
  if (u.includes('ms') || u.includes('millisecond')) return 'ms';
  if (u.includes('byte') || u === 'by') return 'bytes';
  if (u === '1' || u === '%' || u.includes('percent')) return 'percent';
  return 'count';
}

function metricValue(point: ParsedMetricPoint): number {
  if (point.value !== null && Number.isFinite(point.value)) return point.value;
  if (point.valueInt !== null) {
    const n = Number(point.valueInt);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function safeLogAttributes(attributes: Record<string, unknown>, settings: CaptureSettings): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attributes)
      .filter(([key]) => {
        if (settings.redactSensitiveData && SENSITIVE_ATTRIBUTE_PATTERN.test(key)) return false;
        if (!settings.captureRequestHeaders && /^(http\.(request|response)\.header\.|http\.header\.|request\.headers\.|response\.headers\.)/i.test(key)) return false;
        if (!settings.captureRequestBody && /^(http\.(request|response)\.body|request\.body|response\.body)/i.test(key)) return false;
        return true;
      })
      .slice(0, Math.max(1, settings.maxAttributeCount))
      .map(([key, value]) => [key, limitAttributeValue(value, settings.maxAttributeValueLength)]),
  );
}

function limitAttributeValue(value: unknown, maxLength: number, depth = 0): unknown {
  if (typeof value === 'string') return value.slice(0, maxLength);
  if (depth >= 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => limitAttributeValue(item, maxLength, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, limitAttributeValue(item, maxLength, depth + 1)]),
  );
}

function sanitizeSensitiveText(value: string, enabled = true): string {
  if (!enabled) return value;
  return SENSITIVE_TEXT_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, '$1[REDACTED]'),
    value,
  );
}

function sanitizeRequestUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed).pathname || '/';
    }
  } catch {
    // Fall back to stripping the query/hash from malformed URLs.
  }

  return trimmed.split(/[?#]/, 1)[0] || '/';
}

export function mapSpanToTraceRow(span: ParsedSpan, tenant: TenantContext) {
  return {
    id: randomUUID(),
    timestamp: nanoToTelemetryTimestamp(span.startTimeUnixNano),
    org_id: tenant.organizationId,
    project_id: tenant.projectId,
    service: span.resource.serviceName || '',
    serviceVersion: span.resource.serviceVersion || '',
    environment: span.resource.environment || '',
    region: span.resource.region || '',
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId || '',
    name: span.name || '',
    duration: span.durationMs,
    spanKind: span.kind,
    statusCode: span.statusCode,
    statusMessage: span.statusMessage || '',
    dependencyType: getDependencyType(span),
    dependencyName: getDependencyName(span),
  };
}

function getDependencyType(span: ParsedSpan): string {
  if (span.kind !== 3) return '';

  if (
    span.attributes['db.system.name'] ||
    span.attributes['db.system'] ||
    span.attributes.db_system
  ) {
    return 'database';
  }

  if (
    span.attributes['rpc.system'] ||
    span.attributes['rpc.service.name'] ||
    span.attributes['rpc.service']
  ) {
    return 'rpc';
  }

  if (
    span.attributes['http.request.method'] ||
    span.attributes['http.method'] ||
    span.attributes['url.full'] ||
    span.attributes['http.url']
  ) {
    return 'http';
  }

  return 'service';
}

function getDependencyName(span: ParsedSpan): string {
  if (span.kind !== 3) return '';

  return String(
    span.attributes['db.system.name'] ??
      span.attributes['db.system'] ??
      span.attributes['server.address'] ??
      span.attributes['network.peer.address'] ??
      span.attributes['rpc.service.name'] ??
      span.attributes['rpc.service'] ??
      span.resource.serviceName ??
      span.name ??
      '',
  );
}

export function mapSpanToRequestRow(span: ParsedSpan, tenant: TenantContext) {
  if (span.kind !== 2) return null;

  const method =
    String(
      span.attributes['http.request.method'] ??
        span.attributes['http.method'] ??
        '',
    ) || '';
  const route =
    String(
      span.attributes['http.route'] ??
        span.attributes['url.template'] ??
        '',
    ) || '';
  const url =
    String(
      span.attributes['url.path'] ??
        span.attributes['http.target'] ??
        route ??
        span.attributes['http.url'] ??
        span.name ??
        '',
    ) || '';
  if (!method && !url) return null;

  const statusCode = Number(
    span.attributes['http.response.status_code'] ??
      span.attributes['http.status_code'] ??
      0,
  );

  return {
    id: randomUUID(),
    timestamp: nanoToTelemetryTimestamp(span.startTimeUnixNano),
    org_id: tenant.organizationId,
    project_id: tenant.projectId,
    service: span.resource.serviceName || '',
    serviceVersion: span.resource.serviceVersion || '',
    environment: span.resource.environment || '',
    region: span.resource.region || '',
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId || '',
    method,
    route,
    url: sanitizeRequestUrl(url),
    statusCode: Number.isFinite(statusCode) ? statusCode : 0,
    duration: span.durationMs,
    userAgent: String(span.attributes['user_agent.original'] ?? ''),
  };
}

export function mapLogToRow(record: ParsedLogRecord, tenant: TenantContext) {
  const settings = tenant.captureSettings;
  const safeAttributes = safeLogAttributes(record.attributes, settings);
  const attrs: Record<string, unknown> = {
    ...safeAttributes,
    ...(record.traceId ? { traceId: record.traceId } : {}),
    ...(record.spanId ? { spanId: record.spanId } : {}),
    ...(record.resource.serviceVersion
      ? { 'service.version': record.resource.serviceVersion }
      : {}),
    ...(record.resource.environment
      ? { 'deployment.environment': record.resource.environment }
      : {}),
    ...(record.resource.region ? { region: record.resource.region } : {}),
    severityNumber: record.severityNumber,
    severityText: record.severityText,
  };

  return {
    id: randomUUID(),
    timestamp: telemetryTimestamp(record.timestamp),
    org_id: tenant.organizationId,
    project_id: tenant.projectId,
    service: record.resource.serviceName || '',
    serviceVersion: record.resource.serviceVersion || '',
    environment: record.resource.environment || '',
    region: record.resource.region || '',
    traceId: record.traceId || '',
    spanId: record.spanId || '',
    level: record.severityLevel,
    message: sanitizeSensitiveText(record.message, settings.redactSensitiveData).slice(0, settings.maxAttributeValueLength),
    attributes: attrs,
    stackTrace: sanitizeSensitiveText(String(safeAttributes['exception.stacktrace'] ?? ''), settings.redactSensitiveData).slice(0, settings.maxAttributeValueLength),
  };
}

export function mapMetricToRow(point: ParsedMetricPoint, tenant: TenantContext) {
  return {
    id: randomUUID(),
    timestamp: telemetryTimestamp(point.timestamp),
    org_id: tenant.organizationId,
    project_id: tenant.projectId,
    service: point.resource.serviceName || '',
    serviceVersion: point.resource.serviceVersion || '',
    environment: point.resource.environment || '',
    region: point.resource.region || '',
    name: point.metricName,
    value: metricValue(point),
    unit: mapMetricUnit(point.metricUnit),
  };
}
