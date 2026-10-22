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
  severity: 'warning' | 'critical';
  reasons: string[];
  latency: { p50: number; p95: number; p99: number; p95ChangePercent?: number; p99ChangePercent?: number };
  errorRate: number;
  throughputPerMinute: number;
  cpuUtilization?: number;
}

const MIN_SAMPLES = 20;
const WARNING_P95_MS = 500;
const CRITICAL_P95_MS = 1_000;
const WARNING_ERROR_RATE = 0.05;
const CRITICAL_ERROR_RATE = 0.10;
const WARNING_CPU = 0.80;
const CRITICAL_CPU = 0.95;
const REGRESSION_PERCENT = 50;

export function evaluateServicePerformance(current: PerformanceWindow, baseline?: PerformanceBaseline): PerformanceSignal | undefined {
  if (current.sampleCount < MIN_SAMPLES) return undefined;

  const reasons: string[] = [];
  const p95ChangePercent = baseline ? percentChange(current.p95, baseline.p95) : undefined;
  const p99ChangePercent = baseline ? percentChange(current.p99, baseline.p99) : undefined;

  if (current.p95 >= WARNING_P95_MS) reasons.push('p95 latency is elevated');
  if (current.p95 >= CRITICAL_P95_MS) reasons.push('p95 latency is critical');
  if (p95ChangePercent !== undefined && p95ChangePercent >= REGRESSION_PERCENT) reasons.push('p95 latency regressed against baseline');
  if (current.errorRate >= WARNING_ERROR_RATE) reasons.push('error rate is elevated');
  if (current.errorRate >= CRITICAL_ERROR_RATE) reasons.push('error rate is critical');
  if (current.cpuUtilization !== undefined && current.cpuUtilization >= WARNING_CPU) reasons.push('CPU utilization is elevated');
  if (current.cpuUtilization !== undefined && current.cpuUtilization >= CRITICAL_CPU) reasons.push('CPU utilization is critical');
  if (reasons.length === 0) return undefined;

  const critical = current.p95 >= CRITICAL_P95_MS || current.errorRate >= CRITICAL_ERROR_RATE || (current.cpuUtilization ?? 0) >= CRITICAL_CPU;

  return {
    severity: critical ? 'critical' : 'warning',
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
    ...(current.cpuUtilization !== undefined ? { cpuUtilization: current.cpuUtilization } : {}),
  };
}

function percentChange(current: number, baseline: number): number | undefined {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline <= 0) return undefined;
  return ((current - baseline) / baseline) * 100;
}
