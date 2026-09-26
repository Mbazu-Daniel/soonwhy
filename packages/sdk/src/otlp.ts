import { sanitizeAttributes, sanitizeMessage, type SecurityOptions } from './security.js';
import type {
  Attributes,
  ErrorInput,
  LogInput,
  MetricInput,
  ResourceOptions,
} from './types.js';

type OtlpAttribute = { key: string; value: Record<string, unknown> };

const LEVELS: Record<NonNullable<LogInput['level']>, number> = {
  trace: 1,
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
  fatal: 21,
};

export function toLogsPayload(
  records: LogInput[],
  resource: ResourceOptions,
  scopeVersion: string,
  security: SecurityOptions,
): unknown {
  return {
    resourceLogs: [{
      resource: { attributes: toAttributes(resource.attributes, resource, security) },
      scopeLogs: [{
        scope: { name: '@soonwhy/sdk', version: scopeVersion },
        logRecords: records.map((record) => ({
          timeUnixNano: toNano(record.timestamp),
          severityNumber: LEVELS[record.level ?? 'info'],
          severityText: (record.level ?? 'info').toUpperCase(),
          body: { stringValue: sanitizeMessage(record.message, security) },
          attributes: toAttributes(record.attributes, undefined, security),
          ...(record.traceId ? { traceId: record.traceId } : {}),
          ...(record.spanId ? { spanId: record.spanId } : {}),
        })),
      }],
    }],
  };
}

export function toErrorLog(input: ErrorInput): LogInput {
  const error = input.error instanceof Error
    ? input.error
    : new Error(typeof input.error === 'string' ? input.error : 'Unknown error');

  return {
    level: 'error',
    message: error.message,
    timestamp: input.timestamp,
    attributes: {
      ...input.attributes,
      'exception.type': error.name,
      ...(error.stack ? { 'exception.stacktrace': error.stack } : {}),
    },
    traceId: input.traceId,
    spanId: input.spanId,
  };
}

export function toMetricsPayload(
  records: MetricInput[],
  resource: ResourceOptions,
  scopeVersion: string,
  security: SecurityOptions,
): unknown {
  const groups = new Map<string, MetricInput[]>();
  for (const record of records) {
    const existing = groups.get(record.name);
    if (existing) existing.push(record);
    else groups.set(record.name, [record]);
  }

  return {
    resourceMetrics: [{
      resource: { attributes: toAttributes(resource.attributes, resource, security) },
      scopeMetrics: [{
        scope: { name: '@soonwhy/sdk', version: scopeVersion },
        metrics: [...groups.entries()].map(([name, items]) => ({
          name,
          unit: items[0]?.unit ?? '',
          gauge: {
            dataPoints: items.map((item) => ({
              timeUnixNano: toNano(item.timestamp),
              asDouble: item.value,
              attributes: toAttributes(item.attributes, undefined, security),
            })),
          },
        })),
      }],
    }],
  };
}

function toAttributes(attributes?: Attributes, resource?: ResourceOptions, security?: SecurityOptions): OtlpAttribute[] {
  const merged: Attributes = {
    ...(resource?.serviceName ? { 'service.name': resource.serviceName } : {}),
    ...(resource?.serviceVersion ? { 'service.version': resource.serviceVersion } : {}),
    ...(resource?.deploymentEnvironment
      ? { 'deployment.environment.name': resource.deploymentEnvironment }
      : {}),
    ...(resource?.attributes ?? {}),
    ...(attributes ?? {}),
  };

  const sanitized = sanitizeAttributes(merged, security ?? { redactSensitiveData: true, maxAttributeCount: 100, maxAttributeValueLength: 4096 });
  return Object.entries(sanitized).map(([key, value]) => ({
    key,
    value: toAnyValue(value),
  }));
}

function toAnyValue(value: AttributeValueLike): Record<string, unknown> {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  if (value === null) return { stringValue: 'null' };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toAnyValue) } };
  return {
    kvlistValue: {
      values: Object.entries(value).map(([key, item]) => ({ key, value: toAnyValue(item) })),
    },
  };
}

type AttributeValueLike =
  | string
  | number
  | boolean
  | null
  | AttributeValueLike[]
  | { [key: string]: AttributeValueLike };

function toNano(timestamp?: Date | number): string {
  const millis = timestamp instanceof Date ? timestamp.getTime() : timestamp ?? Date.now();
  if (!Number.isFinite(millis)) return String(Date.now() * 1_000_000);
  return String(Math.trunc(millis) * 1_000_000);
}
