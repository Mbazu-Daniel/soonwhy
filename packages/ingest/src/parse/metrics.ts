import { decodeAttributes } from "./attributes";
import { nanoTimestamp } from "./time";
import { resourceFromAttributes } from "./types";
import type { RawAttribute } from "./attribute-types";
import type {
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

type MetricContainer = {
  dataPoints?: DataPoint[];
};

type Metric = {
  name?: string;
  gauge?: MetricContainer;
  sum?: MetricContainer;
  unit?: string;
};

type ScopeMetrics = {
  metrics?: Metric[];
};

type ResourceMetrics = {
  resource?: { attributes?: RawAttribute[] };
  scopeMetrics?: ScopeMetrics[];
};

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

    const scopeMetrics = rm.scopeMetrics ?? [];

    for (const sm of scopeMetrics) {
      for (const metric of sm.metrics ?? []) {
        const metricName = metric.name ?? "";
        if (!metricName) {
          rejected++;
          continue;
        }

        const type: MetricType | null = metric.gauge
          ? "gauge"
          : metric.sum
            ? "sum"
            : null;
        const container =
          type === "gauge" ? metric.gauge : type === "sum" ? metric.sum : null;
        if (!type || !container) {
          rejected++;
          continue;
        }

        for (const dp of container.dataPoints ?? []) {
          try {
            const timeNano = dp.timeUnixNano ?? "0";
            const timestamp = nanoTimestamp(timeNano);
            if (!timestamp) {
              rejected++;
              continue;
            }

            const flags = Number(dp.flags ?? 0) || 0;
            const noRecordedValue = (flags & 1) === 1;
            const rawDouble = dp.asDouble;
            const rawInt = dp.asInt;

            let value: number | null = null;
            if (!noRecordedValue && rawDouble !== undefined) {
              value =
                typeof rawDouble === "number" && Number.isFinite(rawDouble)
                  ? rawDouble
                  : null;
            }

            let valueInt: string | null = null;
            if (!noRecordedValue && rawInt !== undefined) {
              if (typeof rawInt === "string" && /^-?\d+$/.test(rawInt)) {
                valueInt = rawInt;
              } else if (
                typeof rawInt === "number" &&
                Number.isSafeInteger(rawInt)
              ) {
                valueInt = rawInt.toString();
              }
            }

            points.push({
              timestamp,
              metricName,
              metricUnit: metric.unit ?? "",
              metricType: type,
              value,
              valueInt,
              resource: parsedResource,
              attributes: decodeAttributes(dp.attributes ?? []),
            });
          } catch {
            rejected++;
          }
        }
      }
    }
  }

  return { points, rejected };
}
