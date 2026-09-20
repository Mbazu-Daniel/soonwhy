import { describe, expect, it } from 'vitest';
import { parseLogsPayload } from '../src/parse/logs';
import { parseTracesPayload } from '../src/parse/traces';
import { parseMetricsPayload } from '../src/parse/metrics';
import {
  mapLogToRow,
  mapMetricToRow,
  mapSpanToRequestRow,
  mapSpanToTraceRow,
} from '../src/parse/mappers';

const tenant = { projectId: 'proj_1', organizationId: 'org_1' };

describe('OTLP JSON parse + ClickHouse mappers', () => {
  it('maps log records with resource attrs and trace correlation', () => {
    const { records, rejected } = parseLogsPayload({
      resourceLogs: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'api' } },
              { key: 'service.version', value: { stringValue: '1.0.0' } },
              { key: 'deployment.environment', value: { stringValue: 'prod' } },
            ],
          },
          scopeLogs: [
            {
              logRecords: [
                {
                  timeUnixNano: String(BigInt(Date.now()) * 1_000_000n),
                  severityNumber: 9,
                  severityText: 'INFO',
                  body: { stringValue: 'hello' },
                  traceId: 'a'.repeat(32),
                  spanId: 'b'.repeat(16),
                  attributes: [],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(rejected).toBe(0);
    expect(records).toHaveLength(1);
    const row = mapLogToRow(records[0]!, tenant);
    expect(row.org_id).toBe('org_1');
    expect(row.project_id).toBe('proj_1');
    expect(row.service).toBe('api');
    expect(row.level).toBe('info');
    expect(row.message).toBe('hello');
    const attrs = row.attributes as Record<string, unknown>;
    expect(attrs.traceId).toBe('a'.repeat(32));
    expect(attrs.spanId).toBe('b'.repeat(16));
    expect(attrs['service.version']).toBe('1.0.0');
    expect(attrs['deployment.environment']).toBe('prod');
  });

  it('maps spans to traces and HTTP server spans to requests', () => {
    const start = BigInt(Date.now()) * 1_000_000n;
    const end = start + 5_000_000n;
    const { spans, rejected } = parseTracesPayload({
      resourceSpans: [
        {
          resource: {
            attributes: [{ key: 'service.name', value: { stringValue: 'api' } }],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: 'c'.repeat(32),
                  spanId: 'd'.repeat(16),
                  parentSpanId: '',
                  name: 'GET /users',
                  kind: 2,
                  startTimeUnixNano: String(start),
                  endTimeUnixNano: String(end),
                  status: { code: 1 },
                  attributes: [
                    { key: 'http.request.method', value: { stringValue: 'GET' } },
                    { key: 'url.path', value: { stringValue: '/users' } },
                    { key: 'http.response.status_code', value: { intValue: 200 } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(rejected).toBe(0);
    const span = spans[0]!;
    const traceRow = mapSpanToTraceRow(span, tenant);
    expect(traceRow.traceId).toBe('c'.repeat(32));
    expect(traceRow.duration).toBe(5);

    const requestRow = mapSpanToRequestRow(span, tenant);
    expect(requestRow).not.toBeNull();
    expect(requestRow!.method).toBe('GET');
    expect(requestRow!.url).toBe('/users');
    expect(requestRow!.statusCode).toBe(200);
  });

  it('normalizes client database spans for dependency detection', () => {
    const start = BigInt(Date.now()) * 1_000_000n;
    const end = start + 800_000_000n;
    const { spans, rejected } = parseTracesPayload({
      resourceSpans: [
        {
          resource: {
            attributes: [{ key: 'service.name', value: { stringValue: 'api' } }],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: 'e'.repeat(32),
                  spanId: 'f'.repeat(16),
                  parentSpanId: 'd'.repeat(16),
                  name: 'SELECT users',
                  kind: 3,
                  startTimeUnixNano: String(start),
                  endTimeUnixNano: String(end),
                  status: { code: 1 },
                  attributes: [
                    { key: 'db.system.name', value: { stringValue: 'postgresql' } },
                    { key: 'server.address', value: { stringValue: 'postgres' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(rejected).toBe(0);
    const row = mapSpanToTraceRow(spans[0]!, tenant);
    expect(row.spanKind).toBe(3);
    expect(row.dependencyType).toBe('database');
    expect(row.dependencyName).toBe('postgresql');
  });

  it('maps gauge metrics into metrics table rows', () => {
    const { points, rejected } = parseMetricsPayload({
      resourceMetrics: [
        {
          resource: {
            attributes: [{ key: 'service.name', value: { stringValue: 'api' } }],
          },
          scopeMetrics: [
            {
              metrics: [
                {
                  name: 'http.server.duration',
                  unit: 'ms',
                  gauge: {
                    dataPoints: [
                      {
                        timeUnixNano: String(BigInt(Date.now()) * 1_000_000n),
                        asDouble: 12.5,
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(rejected).toBe(0);
    const row = mapMetricToRow(points[0]!, tenant);
    expect(row.name).toBe('http.server.duration');
    expect(row.value).toBe(12.5);
    expect(row.unit).toBe('ms');
    expect(row.service).toBe('api');
  });
});
