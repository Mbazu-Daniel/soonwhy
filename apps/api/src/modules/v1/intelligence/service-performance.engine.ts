export interface PerformanceWindow {
  serviceName: string;
  endpoint: string;
  sampleCount: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  throughputPerMinute: number;
  cpuUtilization?: number;
}

export interface PerformanceBaseline {
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  throughputPerMinute: number;
  cpuUtilization?: number;
}

export interface PerformanceSignal {
  severity: "warning" | "critical";
  reasons: string[];
  latency: {
    p50: number;
    p95: number;
    p99: number;
    p95ChangePercent?: number;
    p99ChangePercent?: number;
  };
  errorRate: number;
  throughputPerMinute: number;
  cpuUtilization?: number;
}

export type ServicePerformanceThresholds = Partial<{
  minSamples: number;
  warningP95Ms: number;
  criticalP95Ms: number;
  warningErrorRate: number;
  criticalErrorRate: number;
  regressionPercent: number;
}>;

const DEFAULT_MIN_SAMPLES = 20;
const DEFAULT_WARNING_P95_MS = 500;
const DEFAULT_CRITICAL_P95_MS = 1_000;
const DEFAULT_WARNING_ERROR_RATE = 0.05;
const DEFAULT_CRITICAL_ERROR_RATE = 0.1;
const WARNING_CPU = 0.8;
const CRITICAL_CPU = 0.95;
const DEFAULT_REGRESSION_PERCENT = 50;

function finite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

export function evaluateServicePerformance(
  current: PerformanceWindow,
  baseline?: PerformanceBaseline,
  thresholds: ServicePerformanceThresholds = {},
): PerformanceSignal | undefined {
  const minSamples = finite(thresholds.minSamples, DEFAULT_MIN_SAMPLES);
  const warningP95Ms = finite(thresholds.warningP95Ms, DEFAULT_WARNING_P95_MS);
  const criticalP95Ms = finite(thresholds.criticalP95Ms, DEFAULT_CRITICAL_P95_MS);
  const warningErrorRate = finite(thresholds.warningErrorRate, DEFAULT_WARNING_ERROR_RATE);
  const criticalErrorRate = finite(thresholds.criticalErrorRate, DEFAULT_CRITICAL_ERROR_RATE);
  const regressionPercent = finite(thresholds.regressionPercent, DEFAULT_REGRESSION_PERCENT);

  if (current.sampleCount < minSamples) return undefined;

  const reasons: string[] = [];
  const p95ChangePercent = baseline
    ? percentChange(current.p95, baseline.p95)
    : undefined;
  const p99ChangePercent = baseline
    ? percentChange(current.p99, baseline.p99)
    : undefined;

  if (current.p95 >= warningP95Ms) reasons.push("p95 latency is elevated");
  if (current.p95 >= criticalP95Ms) reasons.push("p95 latency is critical");
  if (p95ChangePercent !== undefined && p95ChangePercent >= regressionPercent)
    reasons.push("p95 latency regressed against baseline");
  if (current.errorRate >= warningErrorRate)
    reasons.push("error rate is elevated");
  if (current.errorRate >= criticalErrorRate)
    reasons.push("error rate is critical");
  if (
    current.cpuUtilization !== undefined &&
    current.cpuUtilization >= WARNING_CPU
  )
    reasons.push("CPU utilization is elevated");
  if (
    current.cpuUtilization !== undefined &&
    current.cpuUtilization >= CRITICAL_CPU
  )
    reasons.push("CPU utilization is critical");
  if (reasons.length === 0) return undefined;

  const critical =
    current.p95 >= criticalP95Ms ||
    current.errorRate >= criticalErrorRate ||
    (current.cpuUtilization ?? 0) >= CRITICAL_CPU;

  return {
    severity: critical ? "critical" : "warning",
    reasons,
    latency: {
      p50: current.p50,
      p95: current.p95,
      p99: current.p99,
      ...(p95ChangePercent !== undefined ? { p95ChangePercent } : {}),
      ...(p99ChangePercent !== undefined ? { p99ChangePercent } : {}),
    },
    errorRate: current.errorRate,
    throughputPerMinute: current.throughputPerMinute,
    ...(current.cpuUtilization !== undefined
      ? { cpuUtilization: current.cpuUtilization }
      : {}),
  };
}

function percentChange(current: number, baseline: number): number | undefined {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline <= 0)
    return undefined;
  return ((current - baseline) / baseline) * 100;
}
