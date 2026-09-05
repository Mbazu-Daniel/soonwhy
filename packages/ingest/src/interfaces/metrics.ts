import type { ParsedResource } from './resource';

export type MetricType = 'gauge' | 'sum';

export interface ParsedMetricPoint {
  timestamp: string;
  metricName: string;
  metricUnit: string;
  metricType: MetricType;
  value: number | null;
  valueInt: string | null;
  resource: ParsedResource;
  attributes: Record<string, unknown>;
}

export interface ParseMetricsResult {
  points: ParsedMetricPoint[];
  rejected: number;
}
