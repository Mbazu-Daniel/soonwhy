import { describe, expect, it } from 'vitest';
import { parseTracesPayload } from '../src/parse/traces';
import { mapSpanToTraceRow } from '../src/parse/mappers';

const tenant = {
  projectId: 'proj_1',
  organizationId: 'org_1',
  captureSettings: {
    redactSensitiveData: true,
    captureRequestHeaders: false,
    captureRequestBody: false,
    captureResponseBody: false,
    maxAttributeCount: 100,
    maxAttributeValueLength: 4096,
  },
};

function parseSpan(attributes: Array<{ key: string; value: { stringValue?: string } }>) {
  const start = BigInt(Date.now()) * 1_000_000n;
  const end = start + 80_000_000n;
  const result = parseTracesPayload({
    resourceSpans: [{
      resource: { attributes: [{ key: 'service.name', value: { stringValue: 'orders' } }] },
      scopeSpans: [{
        spans: [{
          traceId: '1'.repeat(32),
          spanId: '2'.repeat(16),
          name: 'dependency-op',
          kind: 3,
          startTimeUnixNano: String(start),
          endTimeUnixNano: String(end),
          attributes,
        }],
      }],
    }],
  });

  expect(result.rejected).toBe(0);
  return mapSpanToTraceRow(result.spans[0]!, tenant);
}

describe('dependency identity mapping', () => {
  it('maps Redis as a cache dependency with operation identity', () => {
    const row = parseSpan([
      { key: 'db.system.name', value: { stringValue: 'redis' } },
      { key: 'server.address', value: { stringValue: 'redis.internal' } },
      { key: 'db.operation.name', value: { stringValue: 'GET' } },
    ]);

    expect(row).toMatchObject({
      dependencyType: 'redis',
      dependencyName: 'redis.internal',
      dependencyOperationName: 'GET',
    });
  });

  it('maps Memcached as a cache dependency', () => {
    const row = parseSpan([
      { key: 'db.system.name', value: { stringValue: 'memcached' } },
      { key: 'server.address', value: { stringValue: 'cache.internal' } },
      { key: 'db.operation.name', value: { stringValue: 'GET' } },
    ]);

    expect(row).toMatchObject({
      dependencyType: 'memcached',
      dependencyName: 'cache.internal',
      dependencyOperationName: 'GET',
    });
  });

  it('maps messaging spans to queue dependencies', () => {
    const row = parseSpan([
      { key: 'messaging.system', value: { stringValue: 'kafka' } },
      { key: 'messaging.destination.name', value: { stringValue: 'orders' } },
      { key: 'messaging.operation.name', value: { stringValue: 'process' } },
    ]);

    expect(row).toMatchObject({
      dependencyType: 'queue',
      dependencyName: 'orders',
      dependencyOperationName: 'process',
    });
  });
});
