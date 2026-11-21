import { analyzeTracePayloads } from "../../../telemetry/traces/domain/trace-payloads";
import { CRITICAL_FIELD_PATTERN, EXPOSURE_MAX_SAMPLES } from "./sensitive-exposure.constants";
import type { ExposureCandidate, ExposureSpan } from "./sensitive-exposure.types";

export function findSensitiveExposures(spans: ExposureSpan[]): ExposureCandidate[] {
  const groups = new Map<string, ExposureCandidate>();
  for (const span of spans) {
    const reports = analyzeTracePayloads([{ spanId: span.spanId, name: span.route, attributes: span.attributes }]);
    for (const report of reports) {
      if (report.side !== "response") continue;
      for (const issue of report.issues) {
        if (issue.kind !== "sensitive_field" || !issue.path) continue;
        const key = `${span.service}|${span.route}|${issue.path}`;
        const group = groups.get(key) ?? {
          service: span.service,
          route: span.route,
          path: issue.path,
          severity: CRITICAL_FIELD_PATTERN.test(issue.path) ? "critical" : "warning",
          count: 0,
          spanIds: [],
        };
        group.count += 1;
        if (group.spanIds.length < EXPOSURE_MAX_SAMPLES) group.spanIds.push(span.spanId);
        groups.set(key, group);
      }
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}
