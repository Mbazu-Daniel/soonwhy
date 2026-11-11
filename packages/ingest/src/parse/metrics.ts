import { decodeAttributes } from "./attributes";
import { nanoTimestamp } from "./time";
import { resourceFromAttributes } from "./types";
import type { RawAttribute } from "./attribute-types";
import type {
  AggregationTemporality,
  MetricType,
  ParsedMetricPoint,
  ParseMetricsResult,
} from "../interfaces";

export type { MetricType, ParsedMetricPoint, ParseMetricsResult };

type DataPoint = {
  asDouble?: number;
  asInt?: string | number;
  flags?: number;
  timeUnixNano?: string;
  attributes?: RawAttribute[];
};

type HistogramDataPoint = DataPoint & {
  count?: string | number;
  sum?: number;
  min?: number;
  max?: number;
  bucketCounts?: Array<string | number>;
  explicitBounds?: number[];
};

type ExponentialBuckets = {
  offset?: number;
  bucketCounts?: Array<string | number>;
};

type ExponentialHistogramDataPoint = DataPoint & {
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

type QuantileValue = {
  quantile?: number;
  value?: number;
};

type SummaryDataPoint = DataPoint & {
  count?: string | number;
  sum?: number;
  quantileValues?: QuantileValue[];
};

type NumberContainer = {
  dataPoints?: DataPoint[];
  aggregationTemporality?: number;
};

type HistogramContainer = {
  dataPoints?: HistogramDataPoint[];
  aggregationTemporality?: number;
};

type ExponentialHistogramContainer = {
  dataPoints?: ExponentialHistogramDataPoint[];
  aggregationTemporality?: number;
};

type SummaryContainer = {
  dataPoints?: SummaryDataPoint[];
};

type Metric = {
  name?: string;
  gauge?: NumberContainer;
  sum?: NumberContainer;
  histogram?: HistogramContainer;
  exponentialHistogram?: ExponentialHistogramContainer;
  summary?: SummaryContainer;
  unit?: string;
};

type ScopeMetrics = {
  metrics?: Metric[];
};

type ResourceMetrics = {
  resource?: { attributes?: RawAttribute[] };
  scopeMetrics?: ScopeMetrics[];
};

const TEMPORALITY: AggregationTemporality[] = [
  "unspecified",
  "delta",
  "cumulative",
];

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberList(values: Array<string | number> | undefined): number[] {
  return (values ?? []).flatMap((value) => {
    const number = finiteNumber(value);
    return number === null ? [] : [number];
  });
}

function aggregationTemporality(
  value: number | undefined,
): AggregationTemporality | undefined {
  if (value === undefined) return undefined;
  return TEMPORALITY[value] ?? "unspecified";
}

function numberValue(point: DataPoint): {
  value: number | null;
  valueInt: string | null;
} {
  const flags = Number(point.flags ?? 0) || 0;
  if ((flags & 1) === 1) return { value: null, valueInt: null };

  const rawDouble = point.asDouble;
  const rawInt = point.asInt;
  const value =
    rawDouble !== undefined && Number.isFinite(rawDouble) ? rawDouble : null;
  let valueInt: string | null = null;
  if (rawInt !== undefined) {
    if (typeof rawInt === "string" && /^-?\d+$/.test(rawInt)) valueInt = rawInt;
    else if (typeof rawInt === "number" && Number.isSafeInteger(rawInt))
      valueInt = rawInt.toString();
  }
  return { value, valueInt };
}

export function parseMetricsPayload(
  payload: { resourceMetrics?: ResourceMetrics[] },
): ParseMetricsResult {
  const resourceMetrics = payload.resourceMetrics ?? [];
  const points: ParsedMetricPoint[] = [];
  let rejected = 0;

  for (const rm of resourceMetrics) {
    const parsedResource = resourceFromAttributes({
      attributes: decodeAttributes(rm.resource?.attributes ?? []),
      serviceName: "",
      serviceVersion: "",
      environment: "",
      region: "",
    });

    for (const sm of rm.scopeMetrics ?? []) {
      for (const metric of sm.metrics ?? []) {
        const metricName = metric.name ?? "";
        if (!metricName) {
          rejected++;
          continue;
        }

        if (metric.gauge) {
          rejected += appendNumberPoints(
            points,
            metric,
            "gauge",
            metric.gauge,
            parsedResource,
            undefined,
          );
          continue;
        }
        if (metric.sum) {
          rejected += appendNumberPoints(
            points,
            metric,
            "sum",
            metric.sum,
            parsedResource,
            aggregationTemporality(metric.sum.aggregationTemporality),
          );
          continue;
        }
        if (metric.histogram) {
          rejected += appendHistogramPoints(
            points,
            metric,
            metric.histogram,
            parsedResource,
          );
          continue;
        }
        if (metric.exponentialHistogram) {
          rejected += appendExponentialHistogramPoints(
            points,
            metric,
            metric.exponentialHistogram,
            parsedResource,
          );
          continue;
        }
        if (metric.summary) {
          rejected += appendSummaryPoints(
            points,
            metric,
            metric.summary,
            parsedResource,
          );
          continue;
        }

        rejected++;
      }
    }
  }

  return { points, rejected };
}

function appendNumberPoints(
  points: ParsedMetricPoint[],
  metric: Metric,
  metricType: MetricType,
  container: NumberContainer,
  resource: ParsedMetricPoint["resource"],
  temporality: AggregationTemporality | undefined,
): number {
  let rejected = 0;
  for (const dp of container.dataPoints ?? []) {
    const timestamp = dp.timeUnixNano ? nanoTimestamp(dp.timeUnixNano) : null;
    if (!timestamp) {
      rejected++;
      continue;
    }
    const values = numberValue(dp);
    points.push({
      timestamp,
      metricName: metric.name ?? "",
      metricUnit: metric.unit ?? "",
      metricType,
      value: values.value,
      valueInt: values.valueInt,
      ...(temporality ? { aggregationTemporality: temporality } : {}),
      resource,
      attributes: decodeAttributes(dp.attributes ?? []),
    });
  }
  return rejected;
}

function appendHistogramPoints(
  points: ParsedMetricPoint[],
  metric: Metric,
  container: HistogramContainer,
  resource: ParsedMetricPoint["resource"],
): number {
  let rejected = 0;
  for (const dp of container.dataPoints ?? []) {
    const timestamp = dp.timeUnixNano ? nanoTimestamp(dp.timeUnixNano) : null;
    if (!timestamp) {
      rejected++;
      continue;
    }
    const count = finiteNumber(dp.count) ?? 0;
    const sum = finiteNumber(dp.sum);
    points.push({
      timestamp,
      metricName: metric.name ?? "",
      metricUnit: metric.unit ?? "",
      metricType: "histogram",
      value: count > 0 && sum !== null ? sum / count : null,
      valueInt: null,
      ...(aggregationTemporality(container.aggregationTemporality)
        ? {
            aggregationTemporality: aggregationTemporality(
              container.aggregationTemporality,
            ),
          }
        : {}),
      histogram: {
        count,
        sum,
        min: finiteNumber(dp.min),
        max: finiteNumber(dp.max),
        bucketCounts: numberList(dp.bucketCounts),
        explicitBounds: numberList(dp.explicitBounds),
      },
      resource,
      attributes: decodeAttributes(dp.attributes ?? []),
    });
  }
  return rejected;
}

function appendExponentialHistogramPoints(
  points: ParsedMetricPoint[],
  metric: Metric,
  container: ExponentialHistogramContainer,
  resource: ParsedMetricPoint["resource"],
): number {
  let rejected = 0;
  for (const dp of container.dataPoints ?? []) {
    const timestamp = dp.timeUnixNano ? nanoTimestamp(dp.timeUnixNano) : null;
    if (!timestamp) {
      rejected++;
      continue;
    }
    const count = finiteNumber(dp.count) ?? 0;
    const sum = finiteNumber(dp.sum);
    points.push({
      timestamp,
      metricName: metric.name ?? "",
      metricUnit: metric.unit ?? "",
      metricType: "exponential_histogram",
      value: count > 0 && sum !== null ? sum / count : null,
      valueInt: null,
      ...(aggregationTemporality(container.aggregationTemporality)
        ? {
            aggregationTemporality: aggregationTemporality(
              container.aggregationTemporality,
            ),
          }
        : {}),
      exponentialHistogram: {
        count,
        sum,
        min: finiteNumber(dp.min),
        max: finiteNumber(dp.max),
        scale: finiteNumber(dp.scale) ?? 0,
        zeroCount: finiteNumber(dp.zeroCount) ?? 0,
        zeroThreshold: finiteNumber(dp.zeroThreshold) ?? 0,
        positiveOffset: finiteNumber(dp.positive?.offset) ?? 0,
        positiveBuckets: numberList(dp.positive?.bucketCounts),
        negativeOffset: finiteNumber(dp.negative?.offset) ?? 0,
        negativeBuckets: numberList(dp.negative?.bucketCounts),
      },
      resource,
      attributes: decodeAttributes(dp.attributes ?? []),
    });
  }
  return rejected;
}

function appendSummaryPoints(
  points: ParsedMetricPoint[],
  metric: Metric,
  container: SummaryContainer,
  resource: ParsedMetricPoint["resource"],
): number {
  let rejected = 0;
  for (const dp of container.dataPoints ?? []) {
    const timestamp = dp.timeUnixNano ? nanoTimestamp(dp.timeUnixNano) : null;
    if (!timestamp) {
      rejected++;
      continue;
    }
    const count = finiteNumber(dp.count) ?? 0;
    const sum = finiteNumber(dp.sum) ?? 0;
    points.push({
      timestamp,
      metricName: metric.name ?? "",
      metricUnit: metric.unit ?? "",
      metricType: "summary",
      value: count > 0 ? sum / count : null,
      valueInt: null,
      summary: {
        count,
        sum,
        quantiles: (dp.quantileValues ?? []).flatMap((entry) => {
          const quantile = finiteNumber(entry.quantile);
          const value = finiteNumber(entry.value);
          return quantile === null || value === null
            ? []
            : [{ quantile, value }];
        }),
      },
      resource,
      attributes: decodeAttributes(dp.attributes ?? []),
    });
  }
  return rejected;
}
