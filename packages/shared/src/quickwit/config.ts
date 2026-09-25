export const QUICKWIT_INDEXES = {
  logs: 'telemetry-logs',
  traces: 'telemetry-traces',
  requests: 'telemetry-requests',
  metrics: 'telemetry-metrics',
} as const;

export const QUICKWIT_INDEX_CONFIG = {
  version: '0.9',
  doc_mapping: {
    mode: 'dynamic',
    dynamic_mapping: {
      indexed: true,
      stored: true,
      fast: true,
    },
    field_mappings: [
      {
        name: 'timestamp',
        type: 'datetime',
        input_formats: ['rfc3339'],
        fast: true,
      },
      { name: 'org_id', type: 'text', tokenizer: 'raw', fast: true },
      { name: 'project_id', type: 'text', tokenizer: 'raw', fast: true },
      { name: 'traceId', type: 'text', tokenizer: 'raw', fast: true },
      { name: 'spanId', type: 'text', tokenizer: 'raw', fast: true },
      { name: 'parentSpanId', type: 'text', tokenizer: 'raw', fast: true },
      { name: 'service', type: 'text', tokenizer: 'raw', fast: true },
      { name: 'serviceVersion', type: 'text', tokenizer: 'raw', fast: true },
      { name: 'environment', type: 'text', tokenizer: 'raw', fast: true },
      { name: 'region', type: 'text', tokenizer: 'raw', fast: true },
      { name: 'route', type: 'text', tokenizer: 'raw', fast: true },
    ],
    timestamp_field: 'timestamp',
    tag_fields: [
      'org_id',
      'project_id',
      'traceId',
      'spanId',
      'parentSpanId',
      'service',
      'serviceVersion',
      'environment',
      'region',
      'route',
    ],
  },
  search_settings: {
    default_search_fields: ['message', 'name', 'service', 'route'],
  },
  indexing_settings: {
    commit_timeout_secs: 10,
  },
} as const;
