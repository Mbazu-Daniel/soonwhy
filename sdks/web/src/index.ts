export interface WebSdkOptions {
  apiKey: string;
  endpoint?: string;
  serviceName?: string;
  serviceVersion?: string;
  deploymentEnvironment?: string;
  attributes?: Record<string, unknown>;
  batchSize?: number;
  flushIntervalMs?: number;
  maxRetries?: number;
}

type WebRecord = Record<string, unknown>;
type OtlpAttribute = { key: string; value: Record<string, unknown> };

const SDK_VERSION = '0.1.0';
const DEFAULT_ENDPOINT = 'http://localhost:3002/v1';

export class SoonwhyWeb {
  private readonly options: Required<
    Pick<WebSdkOptions, 'apiKey' | 'endpoint' | 'batchSize' | 'flushIntervalMs' | 'maxRetries'>
  > & Pick<WebSdkOptions, 'serviceName' | 'serviceVersion' | 'deploymentEnvironment' | 'attributes'>;
  private readonly logs: WebRecord[] = [];
  private readonly metrics: WebRecord[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private pendingFlush: Promise<{ sent: number; dropped: number }> | undefined;

  constructor(options: WebSdkOptions) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) throw new Error('Soonwhy web apiKey is required');

    const endpoint = (options.endpoint ?? DEFAULT_ENDPOINT).trim().replace(/\\/+$/, '');
    if (!/^https?:\\/\\//i.test(endpoint)) {
      throw new Error('Soonwhy web endpoint must use http or https');
    }

    const batchSize = options.batchSize ?? 50;
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new Error('Soonwhy web batchSize must be a positive integer');
    }

    const flushIntervalMs = options.flushIntervalMs ?? 5000;
    if (!Number.isFinite(flushIntervalMs) || flushIntervalMs < 0) {
      throw new Error('Soonwhy web flushIntervalMs must be zero or greater');
    }

    const maxRetries = options.maxRetries ?? 2;
    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new Error('Soonwhy web maxRetries must be a non-negative integer');
    }

    this.options = {
      apiKey,
      endpoint,
      batchSize,
      flushIntervalMs,
      maxRetries,
      serviceName: options.serviceName,
      serviceVersion: options.serviceVersion,
      deploymentEnvironment: options.deploymentEnvironment,
      attributes: options.attributes,
    };

    if (flushIntervalMs > 0) {
      this.timer = globalThis.setInterval(() => void this.flush(), flushIntervalMs);
    }
  }

  captureLog(message: string, attributes?: Record<string, unknown>): void {
    this.logs.push({
      level: 'info',
      message,
      timeUnixNano: String(Date.now() * 1_000_000),
      attributes,
    });
    this.flushIfFull();
  }

  captureError(error: unknown, attributes?: Record<string, unknown>): void {
    const value = error instanceof Error ? error : new Error(String(error));
    this.logs.push({
      level: 'error',
      message: value.message,
      timeUnixNano: String(Date.now() * 1_000_000),
      attributes: {
        ...attributes,
        'exception.type': value.name,
        ...(value.stack ? { 'exception.stacktrace': value.stack } : {}),
      },
    });
    this.flushIfFull();
  }

  captureMetric(name: string, value: number, attributes?: Record<string, unknown>): void {
    if (!Number.isFinite(value)) throw new Error('Soonwhy web metric value must be finite');
    this.metrics.push({
      name,
      value,
      timeUnixNano: String(Date.now() * 1_000_000),
      attributes,
    });
    this.flushIfFull();
  }

  async flush(): Promise<{ sent: number; dropped: number }> {
    if (this.pendingFlush) return this.pendingFlush;

    this.pendingFlush = this.flushInternal().finally(() => {
      this.pendingFlush = undefined;
    });

    return this.pendingFlush;
  }

  async close(): Promise<{ sent: number; dropped: number }> {
    if (this.timer !== undefined) globalThis.clearInterval(this.timer);
    this.timer = undefined;
    return this.flush();
  }

  private async flushInternal(): Promise<{ sent: number; dropped: number }> {
    const logs = this.logs.splice(0);
    const metrics = this.metrics.splice(0);
    let sent = 0;
    let dropped = 0;

    if (logs.length) {
      const ok = await this.send('logs', toLogsPayload(logs, this.options));
      if (ok) sent += logs.length;
      else dropped += logs.length;
    }

    if (metrics.length) {
      const ok = await this.send('metrics', toMetricsPayload(metrics, this.options));
      if (ok) sent += metrics.length;
      else dropped += metrics.length;
    }

    return { sent, dropped };
  }

  private async send(signal: 'logs' | 'metrics', payload: unknown): Promise<boolean> {
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      try {
        const response = await fetch(`${this.options.endpoint}/${signal}`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.options.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
          keepalive: true,
        });

        if (response.ok) return true;
      } catch {
        // Retry transient browser/network failures.
      }

      if (attempt < this.options.maxRetries) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, 2 ** attempt * 250));
      }
    }

    return false;
  }

  private flushIfFull(): void {
    if (this.logs.length + this.metrics.length >= this.options.batchSize) {
      void this.flush();
    }
  }
}

function toLogsPayload(records: WebRecord[], options: SoonwhyWeb['options']): unknown {
  return {
    resourceLogs: [
      {
        resource: { attributes: toAttributes(options.attributes, options) },
        scopeLogs: [
          {
            scope: { name: '@soonwhy/web', version: SDK_VERSION },
            logRecords: records.map((record) => ({
              timeUnixNano: record.timeUnixNano,
              severityNumber: record.level === 'error' ? 17 : 9,
              severityText: String(record.level ?? 'info').toUpperCase(),
              body: { stringValue: String(record.message ?? '') },
              attributes: toAttributes(record.attributes as Record<string, unknown> | undefined),
            })),
          },
        ],
      },
    ],
  };
}

function toMetricsPayload(records: WebRecord[], options: SoonwhyWeb['options']): unknown {
  return {
    resourceMetrics: [
      {
        resource: { attributes: toAttributes(options.attributes, options) },
        scopeMetrics: [
          {
            scope: { name: '@soonwhy/web', version: SDK_VERSION },
            metrics: [
              {
                name: String(records[0]?.name ?? 'soonwhy.metric'),
                unit: '',
                gauge: {
                  dataPoints: records.map((record) => ({
                    timeUnixNano: record.timeUnixNano,
                    asDouble: Number(record.value),
                    attributes: toAttributes(record.attributes as Record<string, unknown> | undefined),
                  })),
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

function toAttributes(
  attributes?: Record<string, unknown>,
  options?: Pick<WebSdkOptions, 'serviceName' | 'serviceVersion' | 'deploymentEnvironment' | 'attributes'>,
): OtlpAttribute[] {
  const merged = {
    ...(options?.serviceName ? { 'service.name': options.serviceName } : {}),
    ...(options?.serviceVersion ? { 'service.version': options.serviceVersion } : {}),
    ...(options?.deploymentEnvironment
      ? { 'deployment.environment.name': options.deploymentEnvironment }
      : {}),
    ...(options?.attributes ?? {}),
    ...(attributes ?? {}),
  };

  return Object.entries(merged).map(([key, value]) => ({
    key,
    value: toAnyValue(value),
  }));
}

function toAnyValue(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  }
  if (value === null || value === undefined) return { stringValue: String(value ?? '') };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toAnyValue) } };
  if (typeof value === 'object') {
    return {
      kvlistValue: {
        values: Object.entries(value as Record<string, unknown>).map(([key, item]) => ({
          key,
          value: toAnyValue(item),
        })),
      },
    };
  }
  return { stringValue: String(value) };
}
