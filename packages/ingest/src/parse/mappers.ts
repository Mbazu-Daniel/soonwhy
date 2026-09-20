import { randomUUID } from 'crypto';
import { nanoToMs } from './time';
import type { ParsedLogRecord, ParsedMetricPoint, ParsedSpan, TenantContext } from '../interfaces';

export type { TenantContext };

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

export function mapSpanToTraceRow(span: ParsedSpan, tenant: TenantContext) {
  return {
    id: randomUUID(),
    timestamp: nanoToTelemetryTimestamp(span.startTimeUnixNano),
    org_id: tenant.organizationId,
    project_id: tenant.projectId,
    service: span.resource.serviceName || '',
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId || '',
    name: span.name || '',
    duration: span.durationMs,
    spanKind: span.kind,
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
  const url =
    String(
      span.attributes['url.path'] ??
        span.attributes['http.target'] ??
        span.attributes['http.route'] ??
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
    method,
    url,
    statusCode: Number.isFinite(statusCode) ? statusCode : 0,
    duration: span.durationMs,
    userAgent: String(span.attributes['user_agent.original'] ?? ''),
    ip: String(span.attributes['client.address'] ?? span.attributes['net.peer.ip'] ?? ''),
  };
}

export function mapLogToRow(record: ParsedLogRecord, tenant: TenantContext) {
  const attrs: Record<string, unknown> = {
    ...record.attributes,
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
    level: record.severityLevel,
    message: record.message,
    attributes: attrs,
    stackTrace: String(record.attributes['exception.stacktrace'] ?? ''),
  };
}

export function mapMetricToRow(point: ParsedMetricPoint, tenant: TenantContext) {
  return {
    id: randomUUID(),
    timestamp: telemetryTimestamp(point.timestamp),
    org_id: tenant.organizationId,
    project_id: tenant.projectId,
    service: point.resource.serviceName || '',
    name: point.metricName,
    value: metricValue(point),
    unit: mapMetricUnit(point.metricUnit),
  };
}
