import { createTelemetryIdentity } from "./telemetry-identity";

const MIN_SAMPLES = 5;

export type RuntimeFamily =
  | "cpu"
  | "memory"
  | "event_loop"
  | "event_loop_delay";

interface RuntimeMetricSpec {
  family: RuntimeFamily;
  names: readonly string[];
  warning: number;
  critical: number;
  unit: string;
}

// OTel runtime conventions: utilization is a 0..1 ratio, event loop delay is seconds.
// Some exporters emit percentages or milliseconds instead, so the detector calibrates
// values into the spec unit before comparing them with the thresholds.
const RUNTIME_METRIC_SPECS: readonly RuntimeMetricSpec[] = [
  {
    family: "cpu",
    names: [
      "process.cpu.utilization",
      "system.cpu.utilization",
      "container.cpu.utilization",
    ],
    warning: 0.85,
    critical: 0.95,
    unit: "ratio",
  },
  {
    family: "memory",
    names: [
      "process.memory.utilization",
      "container.memory.utilization",
      "runtime.memory.utilization",
    ],
    warning: 0.9,
    critical: 0.98,
    unit: "ratio",
  },
  {
    family: "event_loop",
    names: ["nodejs.eventloop.utilization"],
    warning: 0.8,
    critical: 0.95,
    unit: "ratio",
  },
  {
    family: "event_loop_delay",
    names: ["nodejs.eventloop.delay.p95", "nodejs.eventloop.delay.p99"],
    warning: 0.1,
    critical: 0.5,
    unit: "s",
  },
];

const SPEC_BY_METRIC_NAME = new Map(
  RUNTIME_METRIC_SPECS.flatMap((spec) =>
    spec.names.map((name) => [name, spec] as const),
  ),
);

export const RUNTIME_METRIC_NAMES: readonly string[] = Array.from(
  SPEC_BY_METRIC_NAME.keys(),
);

export interface RuntimeMetricSample {
  timestamp: string;
  service: string;
  name: string;
  value: number;
}

export interface RuntimeCandidate {
  serviceName: string;
  metricName: string;
  family: RuntimeFamily;
  unit: string;
  signal: {
    sampleCount: number;
    p50: number;
    p95: number;
    p99: number;
    threshold: number;
    severity: "warning" | "critical";
    baselineP95?: number;
    p95ChangePercent?: number;
  };
  samples: RuntimeMetricSample[];
  identity: ReturnType<typeof createTelemetryIdentity>;
  recommendation: string;
}

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
    const p50 = percentile(values, 0.5);
    const p95 = percentile(values, 0.95);
    const p99 = percentile(values, 0.99);
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
    // ponytail: exporter calibration. Percent emitters send 0..100, OTel sends 0..1.
    return value > 1 && value <= 100 ? value / 100 : value;
  }

  // ponytail: exporter calibration. Millisecond emitters send values above 1 for these metrics.
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

function percentile(values: number[], rank: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * rank;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  return (
    (sorted[lower] ?? 0) +
    ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * (index - lower)
  );
}
