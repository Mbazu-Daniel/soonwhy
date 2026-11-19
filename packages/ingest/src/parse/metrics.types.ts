import type { RawAttribute } from "./attribute-types";

export type DataPoint = {
  asDouble?: number;
  asInt?: string | number;
  flags?: number;
  timeUnixNano?: string;
  attributes?: RawAttribute[];
};

export type HistogramDataPoint = DataPoint & {
  count?: string | number;
  sum?: number;
  min?: number;
  max?: number;
  bucketCounts?: Array<string | number>;
  explicitBounds?: number[];
};

export type ExponentialBuckets = {
  offset?: number;
  bucketCounts?: Array<string | number>;
};

export type ExponentialHistogramDataPoint = DataPoint & {
  count?: string | number;
  sum?: number;
  min?: number;
  max?: number;
  scale?: number;
  zeroCount?: string | number;
  zeroThreshold?: number;
  positive?: ExponentialBuckets;
  negative?: ExponentialBuckets;
};

export type QuantileValue = {
  quantile?: number;
  value?: number;
};

export type SummaryDataPoint = DataPoint & {
  count?: string | number;
  sum?: number;
  quantileValues?: QuantileValue[];
};

export type NumberContainer = {
  dataPoints?: DataPoint[];
  aggregationTemporality?: number;
};

export type HistogramContainer = {
  dataPoints?: HistogramDataPoint[];
  aggregationTemporality?: number;
};

export type ExponentialHistogramContainer = {
  dataPoints?: ExponentialHistogramDataPoint[];
  aggregationTemporality?: number;
};

export type SummaryContainer = {
  dataPoints?: SummaryDataPoint[];
};

export type Metric = {
  name?: string;
  gauge?: NumberContainer;
  sum?: NumberContainer;
  histogram?: HistogramContainer;
  exponentialHistogram?: ExponentialHistogramContainer;
  summary?: SummaryContainer;
  unit?: string;
};

export type ScopeMetrics = {
  metrics?: Metric[];
};

export type ResourceMetrics = {
  resource?: { attributes?: RawAttribute[] };
  scopeMetrics?: ScopeMetrics[];
};
