import { describe, expect, it } from 'vitest';
import {
  decodeProtobufPayload,
  encodeTraceRequestForTest,
  encodePartialSuccess,
} from '../src/parse/protobuf';
import { parseTracesPayload } from '../src/parse/traces';

describe('OTLP protobuf decode', () => {
  it('decodes ExportTraceServiceRequest bytes into parseable JSON shape', () => {
    const traceId = Buffer.from('c'.repeat(32), 'hex');
    const spanId = Buffer.from('d'.repeat(16), 'hex');
    const start = String(BigInt(Date.now()) * 1_000_000n);

    const bytes = encodeTraceRequestForTest({
      resourceSpans: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: 'proto-service' },
              },
            ],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId,
                  spanId,
                  name: 'GET /proto',
                  kind: 2,
                  startTimeUnixNano: start,
                  endTimeUnixNano: String(BigInt(start) + 1_000_000n),
                  attributes: [],
                  events: [],
                  links: [],
                },
              ],
            },
          ],
        },
      ],
    });

    const decoded = decodeProtobufPayload(Buffer.from(bytes), 'trace');
    expect(decoded).not.toBeNull();

    const { spans, rejected } = parseTracesPayload(decoded);
    expect(rejected).toBe(0);
    expect(spans).toHaveLength(1);
    expect(spans[0]!.traceId).toBe('c'.repeat(32));
    expect(spans[0]!.spanId).toBe('d'.repeat(16));
    expect(spans[0]!.resource.serviceName).toBe('proto-service');
  });

  it('encodes protobuf partial success responses', () => {
    const empty = encodePartialSuccess('trace', 0, '');
    expect(empty.byteLength).toBeGreaterThanOrEqual(0);

    const partial = encodePartialSuccess(
      'trace',
      3,
      '3 invalid or over-limit spans were rejected',
    );
    expect(partial.byteLength).toBeGreaterThan(0);
  });
});
