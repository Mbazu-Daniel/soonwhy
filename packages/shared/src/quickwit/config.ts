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
    ],
    timestamp_field: 'timestamp',
    tag_fields: ['org_id', 'project_id'],
  },
  search_settings: {
    default_search_fields: ['message', 'name', 'service'],
  },
  indexing_settings: {
    commit_timeout_secs: 10,
  },
} as const;
