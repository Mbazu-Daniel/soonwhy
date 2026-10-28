export const ALERT_METRICS = [
  { value: 'http.server.request.duration.p95', label: 'HTTP duration P95 (ms)' },
  { value: 'http.server.request.duration.p50', label: 'HTTP duration P50 (ms)' },
  { value: 'http.server.request.duration.p99', label: 'HTTP duration P99 (ms)' },
  { value: 'http.server.request.errors.rate', label: 'HTTP error rate (%)' },
  { value: 'http.server.request.count', label: 'HTTP request count' },
] as const;

export const ALERT_OPERATORS = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'eq', label: '=' },
  { value: 'ne', label: '≠' },
] as const;

export const ALERT_WINDOWS = ['1m', '5m', '15m', '1h'] as const;

export const ALERT_AGGREGATIONS = ['avg', 'max', 'min', 'sum', 'rate', 'count'] as const;

export const ALERT_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

export const ALERT_STATUSES = ['active', 'disabled'] as const;

export function emptyAlertCondition() {
  return {
    type: 'threshold',
    metric: 'http.server.request.duration.p95',
    operator: 'gt',
    value: 1000,
    window: '5m',
    aggregation: 'avg',
    description: '',
  };
}

export function metricLabel(metric: string) {
  return ALERT_METRICS.find((item) => item.value === metric)?.label ?? metric;
}

export function operatorLabel(operator: string) {
  return ALERT_OPERATORS.find((item) => item.value === operator)?.label ?? operator;
}
