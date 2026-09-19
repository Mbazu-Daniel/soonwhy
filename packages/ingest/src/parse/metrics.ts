import { decodeAttributes } from './attributes';
import { finiteNumber, int64String } from './coerce';
import { nanoTimestamp } from './time';
import { resourceFromAttributes } from './types';
import type {
  MetricType,
  ParsedMetricPoint,
  ParseMetricsResult,
} from '../interfaces';

export type { MetricType, ParsedMetricPoint, ParseMetricsResult };

export function parseMetricsPayload(payload: any): ParseMetricsResult {
  const resourceMetrics = payload.resourceMetrics || payload.resource_metrics || [];
  const points: ParsedMetricPoint[] = [];
  let rejected = 0;

  for (const rm of resourceMetrics) {
    const resourceAttrs = decodeAttributes(rm.resource?.attributes || []);
    const parsedResource = resourceFromAttributes(resourceAttrs);

    const scopeMetrics =
      rm.scopeMetrics ||
      rm.scope_metrics ||
      rm.instrumentationLibraryMetrics ||
      rm.instrumentation_library_metrics ||
      [];

    for (const sm of scopeMetrics) {
      for (const metric of sm.metrics || []) {
        const metricName = metric.name || '';
        if (!metricName) {
          rejected++;
          continue;
        }

        const type: MetricType | null = metric.gauge
          ? 'gauge'
          : metric.sum
            ? 'sum'
            : null;
        const container = type === 'gauge' ? metric.gauge : type === 'sum' ? metric.sum : null;
        if (!type || !container) {
          rejected++;
          continue;
        }

        for (const dp of container.dataPoints || container.data_points || []) {
          try {
            const timeNano = dp.timeUnixNano || dp.time_unix_nano || '0';
            const timestamp = nanoTimestamp(timeNano);
            if (!timestamp) {
              rejected++;
              continue;
            }

            const flags = Number(dp.flags) || 0;
            const noRecordedValue = (flags & 1) === 1;
            const rawDouble = dp.asDouble ?? dp.as_double;
            const rawInt = dp.asInt ?? dp.as_int;
            if (rawDouble === undefined && rawInt === undefined) {
              rejected++;
              continue;
            }

            points.push({
              timestamp,
              metricName,
              metricUnit: metric.unit || '',
              metricType: type,
              value: rawDouble !== undefined ? finiteNumber(rawDouble) : null,
              valueInt: rawInt !== undefined ? int64String(rawInt) : null,
              resource: parsedResource,
              attributes: decodeAttributes(dp.attributes || []),
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
