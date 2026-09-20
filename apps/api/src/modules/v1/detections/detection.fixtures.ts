export const checkoutRegressionFixture = {
  service: {
    current: {
      key: 'checkout-api',
      doc_count: 100,
      latency: { values: { '95.0': 1_600 } },
      errors: { doc_count: 10 },
    },
    baseline: {
      key: 'checkout-api',
      doc_count: 120,
      latency: { values: { '95.0': 700 } },
      errors: { doc_count: 2 },
    },
  },
  dependency: {
    current: {
      service: 'checkout-api',
      dependency: {
        key: 'postgres',
        doc_count: 60,
        latency: { values: { '95.0': 900 } },
        dependencyType: { buckets: [{ key: 'database', doc_count: 60 }] },
      },
    },
    baseline: {
      service: 'checkout-api',
      dependency: {
        key: 'postgres',
        doc_count: 80,
        latency: { values: { '95.0': 250 } },
        dependencyType: { buckets: [{ key: 'database', doc_count: 80 }] },
      },
    },
  },
  trace: {
    hits: [
      {
        _source: {
          timestamp: '2026-09-20T18:10:00.000Z',
          service: 'checkout-api',
          traceId: 'trace-checkout-001',
          spanId: 'span-http-001',
          name: 'POST /checkout',
          duration: 1_500,
          parentSpanId: undefined,
        },
      },
      {
        _source: {
          timestamp: '2026-09-20T18:10:00.020Z',
          service: 'checkout-api',
          traceId: 'trace-checkout-001',
          spanId: 'span-db-001',
          name: 'SELECT orders',
          duration: 1_000,
          parentSpanId: 'span-http-001',
          spanKind: 3,
          dependencyName: 'postgres',
          dependencyType: 'database',
        },
      },
    ],
  },
  dependencyEvidence: [
    {
      _source: {
        service: 'checkout-api',
        dependencyName: 'postgres',
        dependencyType: 'database',
        traceId: 'trace-checkout-001',
        spanId: 'span-db-001',
        name: 'SELECT orders',
        duration: 1_000,
        timestamp: '2026-09-20T18:10:00.020Z',
      },
    },
  ],
};
