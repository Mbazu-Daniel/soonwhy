import { createTelemetryIdentity } from "@soonwhy/shared";
import { percentile } from './percentile';
import type { RuntimeFamily, RuntimeMetricSample, RuntimeCandidate } from "./runtime-degradation.detector.types";
import type { RuntimeMetricSpec } from "./runtime-degradation.detector.types";
import { MIN_SAMPLES, SPEC_BY_METRIC_NAME } from "./runtime-degradation.detector.constants";

export function detectRuntimeDegradation(
  current: RuntimeMetricSample[],
  baseline: RuntimeMetricSample[] = [],
): RuntimeCandidate[] {
  const currentGroups = groupByMetric(current);
  const baselineGroups = groupByMetric(baseline);
  const candidates: RuntimeCandidate[] = [];

  for (const [key, samples] of currentGroups) {
    if (samples.length < MIN_SAMPLES) continue;

    const [serviceName, metricName] = key.split("|");
    if (!serviceName || !metricName) continue;

    const spec = SPEC_BY_METRIC_NAME.get(metricName);
    if (!spec) continue;

    const values = samples.map((sample) => sample.value);
    const p50 = percentile(values, 0.5) ?? 0;
    const p95 = percentile(values, 0.95) ?? 0;
    const p99 = percentile(values, 0.99) ?? 0;
    const severity =
      p95 >= spec.critical
        ? "critical"
        : p95 >= spec.warning
          ? "warning"
          : undefined;
    if (!severity) continue;

    const baselineValues = (baselineGroups.get(key) ?? []).map(
      (sample) => sample.value,
    );
    const baselineP95 =
      baselineValues.length >= MIN_SAMPLES
        ? percentile(baselineValues, 0.95)
        : undefined;
    const p95ChangePercent =
      baselineP95 !== undefined && baselineP95 > 0
        ? ((p95 - baselineP95) / baselineP95) * 100
        : undefined;

    candidates.push({
      serviceName,
      metricName,
      family: spec.family,
      unit: spec.unit,
      signal: {
        sampleCount: samples.length,
        p50,
        p95,
        p99,
        threshold: severity === "critical" ? spec.critical : spec.warning,
        severity,
        ...(baselineP95 !== undefined ? { baselineP95 } : {}),
        ...(p95ChangePercent !== undefined ? { p95ChangePercent } : {}),
      },
      samples: [...samples]
        .sort((left, right) => right.value - left.value)
        .slice(0, 10),
      identity: createTelemetryIdentity({
        domain: "runtime",
        serviceName,
        resourceName: metricName,
        identityAttributes: {
          metricName,
          runtimeFamily: spec.family,
        },
      }),
      recommendation: runtimeRecommendation(spec.family),
    });
  }

  return candidates;
}

function groupByMetric(
  samples: RuntimeMetricSample[],
): Map<string, RuntimeMetricSample[]> {
  const groups = new Map<string, RuntimeMetricSample[]>();

  for (const sample of samples) {
    const spec = SPEC_BY_METRIC_NAME.get(sample.name);
    if (
      !spec ||
      !sample.service ||
      !Number.isFinite(sample.value) ||
      sample.value < 0
    )
      continue;

    const value = calibrate(sample.value, spec);
    const key = sample.service + "|" + sample.name;
    const group = groups.get(key) ?? [];
    group.push({ ...sample, value });
    groups.set(key, group);
  }

  return groups;
}

function calibrate(value: number, spec: RuntimeMetricSpec): number {
  if (spec.unit === "ratio") {
    return value > 1 && value <= 100 ? value / 100 : value;
  }

  return value > 1 ? value / 1000 : value;
}

function runtimeRecommendation(family: RuntimeFamily): string {
  switch (family) {
    case "cpu":
      return "Inspect CPU-heavy request paths, synchronous work, JSON serialization, regexes, and loops. Correlate the saturation window with request volume and deployments before scaling or changing the runtime.";
    case "memory":
      return "Inspect heap growth, cache size, retained payloads, and allocation-heavy paths. Check whether the growth is workload-driven or a leak before raising memory limits.";
    case "event_loop":
      return "Inspect synchronous work blocking the event loop, large payload handling, and CPU-bound handlers. Move blocking work off the request path before adding capacity.";
    default:
      return "Inspect event loop delay alongside CPU saturation and slow spans. Blocking synchronous work is the usual cause; confirm with trace evidence before changing the runtime.";
  }
}
