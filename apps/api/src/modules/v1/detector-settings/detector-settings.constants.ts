export type DetectorConfigInput = {
  enabled?: boolean;
  thresholds?: Record<string, number>;
};


export type DetectorDefinition = {
  key: string;
  label: string;
  description: string;
  thresholdKeys: string[];
};

export type FeatureFlagDefinition = {
  key: string;
  label: string;
  description: string;
  defaultValue: boolean;
};

export const DETECTOR_DEFINITIONS: readonly DetectorDefinition[] = [
  {
    key: "service_performance",
    label: "Service performance",
    description:
      "Detects elevated service latency and error rates across service-level aggregates.",
    thresholdKeys: [
      "minSamples",
      "warningP95Ms",
      "criticalP95Ms",
      "warningErrorRate",
      "criticalErrorRate",
      "regressionPercent",
    ],
  },
  {
    key: "throughput",
    label: "Throughput",
    description:
      "Detects a material drop in request volume against the previous comparable window.",
    thresholdKeys: [
      "minBaselineSamples",
      "dropRatio",
      "criticalChangePercent",
    ],
  },
  {
    key: "endpoint_performance",
    label: "Endpoint performance",
    description:
      "Detects endpoint latency, throughput and error-rate regressions.",
    thresholdKeys: [
      "minSamples",
      "minBaselineSamples",
      "latencySignalMs",
      "latencyRegressionPercent",
      "throughputRegressionPercent",
      "errorRegressionPercent",
      "errorRegressionDelta",
    ],
  },
  {
    key: "dependency_latency",
    label: "Dependency latency",
    description:
      "Detects database, cache, queue and HTTP dependency degradation.",
    thresholdKeys: [
      "minSamples",
      "minBaselineSamples",
      "latencySignalMs",
      "latencyRegressionPercent",
      "errorSignalRate",
      "errorRegressionPercent",
      "errorRegressionDelta",
      "throughputRegressionPercent",
    ],
  },
  {
    key: "database_query",
    label: "Slow database queries",
    description: "Detects slow or regressed database query fingerprints.",
    thresholdKeys: [],
  },
  {
    key: "database_latency_contribution",
    label: "Database latency contribution",
    description:
      "Detects database spans that dominate total trace duration.",
    thresholdKeys: [],
  },
  {
    key: "database_connection_pool",
    label: "Database connection pool",
    description:
      "Detects connection pool utilization, pending requests and timeouts.",
    thresholdKeys: [],
  },
  {
    key: "database_connection_wait",
    label: "Database connection wait",
    description: "Detects elevated database connection acquisition wait times.",
    thresholdKeys: [],
  },
  {
    key: "database_batch",
    label: "Database batch regression",
    description:
      "Detects regressed or high-volume database batch operations.",
    thresholdKeys: [],
  },
  {
    key: "database_dependency_degradation",
    label: "Database dependency degradation",
    description:
      "Detects correlated database degradation across latency, errors, pools and waits.",
    thresholdKeys: [],
  },
  {
    key: "database_timeout",
    label: "Database timeouts",
    description: "Detects elevated database timeout rates.",
    thresholdKeys: [],
  },
  {
    key: "database_result_set",
    label: "Database result sets",
    description:
      "Detects large result sets and regressions in returned rows.",
    thresholdKeys: [],
  },
  {
    key: "database_error",
    label: "Database errors",
    description: "Detects elevated database error rates.",
    thresholdKeys: [],
  },
  {
    key: "database_query_volume",
    label: "Database query volume",
    description:
      "Detects material increases in repeated query volume.",
    thresholdKeys: [],
  },
  {
    key: "database_n_plus_one",
    label: "Database N+1",
    description:
      "Detects repeated database queries under a parent span.",
    thresholdKeys: [],
  },
  {
    key: "database_lock_contention",
    label: "Database lock contention",
    description:
      "Detects database lock errors and overlapping lock waits.",
    thresholdKeys: [],
  },
  {
    key: "trace_span",
    label: "Dominant trace span",
    description:
      "Detects spans that account for a large share of trace duration.",
    thresholdKeys: [],
  },
  {
    key: "runtime_degradation",
    label: "Runtime degradation",
    description:
      "Detects elevated runtime saturation and garbage collection pressure.",
    thresholdKeys: [],
  },
  {
    key: "bottleneck",
    label: "Correlated bottleneck",
    description:
      "Detects latency findings reinforced by dependency or database signals.",
    thresholdKeys: [],
  },
] as const;

export const DETECTOR_KEYS = DETECTOR_DEFINITIONS.map(
  (definition) => definition.key,
) as [string, ...string[]];

export const FEATURE_FLAG_DEFINITIONS: readonly FeatureFlagDefinition[] = [
  {
    key: "detections.enabled",
    label: "Detections",
    description: "Master switch for running detectors for the organisation.",
    defaultValue: true,
  },
  {
    key: "detections.async",
    label: "Async detection runs",
    description:
      "Allow detection runs to be queued and executed in the background.",
    defaultValue: true,
  },
  {
    key: "detections.cache",
    label: "Detection query cache",
    description:
      "Cache expensive Quickwit detector queries for a short window.",
    defaultValue: true,
  },
  {
    key: "detections.telemetry",
    label: "Detection telemetry",
    description:
      "Publish detector run and finding metadata to NATS JetStream for Quickwit indexing.",
    defaultValue: true,
  },
  {
    key: "detections.correlation",
    label: "Correlation findings",
    description:
      "Emit correlated bottleneck findings from multiple detector signals.",
    defaultValue: true,
  },
  {
    key: "detections.issue_lifecycles",
    label: "Issue lifecycles",
    description:
      "Apply issue lifecycle rules for findings produced by detection runs.",
    defaultValue: true,
  },
] as const;

export const FEATURE_FLAG_KEYS = FEATURE_FLAG_DEFINITIONS.map(
  (definition) => definition.key,
) as [string, ...string[]];

export const DEFAULT_FEATURE_FLAGS: Record<string, boolean> = Object.fromEntries(
  FEATURE_FLAG_DEFINITIONS.map((definition) => [
    definition.key,
    definition.defaultValue,
  ]),
);


export const DETECTOR_THRESHOLD_KEYS: Record<string, readonly string[]> =
  Object.fromEntries(
    DETECTOR_DEFINITIONS.map((definition) => [
      definition.key,
      definition.thresholdKeys,
    ]),
  );

