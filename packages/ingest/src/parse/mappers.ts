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
    ...(typeof span.attributes['error.type'] === 'string' ? { errorType: span.attributes['error.type'] } : {}),
    dependencyType: getDependencyType(span),
    dependencyName: getDependencyName(span),
    ...(getDatabaseAttributes(span)),
  };
}

function getDatabaseAttributes(span: ParsedSpan): Record<string, string | number> {
  if (getDependencyType(span) !== 'database') return {};

  const queryText = firstStringAttribute(span, ['db.query.text', 'db.statement']);
  const querySummary = firstStringAttribute(span, ['db.query.summary']);
  const operationName = firstStringAttribute(span, ['db.operation.name', 'db.operation']);
  const systemName = firstStringAttribute(span, ['db.system.name', 'db.system', 'db_system']);
  const collectionName = firstStringAttribute(span, ['db.collection.name', 'db.sql.table']);
  const returnedRows = firstFiniteNumberAttribute(span, ['db.response.returned_rows']);
  const batchSize = firstFiniteNumberAttribute(span, ['db.operation.batch.size']);

  return {
    ...(queryText ? { dbQueryText: sanitizeDatabaseQuery(queryText) } : {}),
    ...(querySummary ? { dbQuerySummary: querySummary.slice(0, 500) } : {}),
    ...(operationName ? { dbOperationName: operationName.slice(0, 200) } : {}),
    ...(systemName ? { dbSystemName: systemName.slice(0, 100) } : {}),
    ...(collectionName ? { dbCollectionName: collectionName.slice(0, 500) } : {}),
    ...(returnedRows !== undefined ? { dbReturnedRows: returnedRows } : {}),
    ...(batchSize !== undefined ? { dbBatchSize: batchSize } : {}),
  };
}

function firstStringAttribute(span: ParsedSpan, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = span.attributes[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function firstFiniteNumberAttribute(span: ParsedSpan, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = span.attributes[key];
    const number = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

function sanitizeDatabaseQuery(query: string): string {
  return query
    .replace(/'(?:''|[^'])*'/g, '?')
    .replace(/"(?:""|[^"])*"/g, '?')
    .replace(/\b\d+(?:\.\d+)?\b/g, '?')
    .replace(/\b(?:true|false|null)\b/gi, '?')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16_384);
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
  const connectionPoolName = typeof point.attributes['db.client.connection.pool.name'] === 'string'
    ? point.attributes['db.client.connection.pool.name']
    : undefined;
  const connectionPoolState = typeof point.attributes['db.client.connection.state'] === 'string'
    ? point.attributes['db.client.connection.state']
    : undefined;
  const attributes = Object.fromEntries(Object.entries(point.attributes).slice(0, 50));

  if (connectionPoolName) attributes['db.client.connection.pool.name'] = connectionPoolName;
  if (connectionPoolState) attributes['db.client.connection.state'] = connectionPoolState;

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
    attributes,
    ...(connectionPoolName ? { connectionPoolName } : {}),
  };
}
