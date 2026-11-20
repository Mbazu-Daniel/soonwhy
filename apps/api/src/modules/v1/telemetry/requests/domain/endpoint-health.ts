import {
  ERROR_FREE_POINTS, ERROR_RATE_ZERO_POINTS, FAST_P95_MS, GRADES, LATENCY_POINTS, SLOW_P95_MS, TAIL_BAD_RATIO, TAIL_OK_RATIO,
  TAIL_POINTS, TREND_ERROR_POINTS, TREND_LATENCY_CHANGE, TREND_LATENCY_MIN_MS, TREND_MIN_REQUESTS,
} from "./endpoint-health.constants";
import type { EndpointHealth, EndpointTrend, Grade, ProjectHealth } from "./endpoint-health.types";
import type { RequestStat } from "./requests.repository.types";

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;

export function gradeOf(score: number): Grade {
  return GRADES.find((entry) => score >= entry.min)!.grade;
}

export function scoreEndpoint(stat: RequestStat): number {
  const latency = LATENCY_POINTS * (1 - clamp((stat.p95 - FAST_P95_MS) / (SLOW_P95_MS - FAST_P95_MS)));
  const errors = ERROR_FREE_POINTS * (1 - clamp(stat.errorRate / ERROR_RATE_ZERO_POINTS));
  const ratio = stat.p50 > 0 ? stat.p99 / stat.p50 : 1;
  const tail = TAIL_POINTS * (1 - clamp((ratio - TAIL_OK_RATIO) / (TAIL_BAD_RATIO - TAIL_OK_RATIO)));
  return Math.round(latency + errors + tail);
}

export function mergeStats(stats: RequestStat[]): RequestStat[] {
  const groups = new Map<string, RequestStat[]>();
  for (const stat of stats) {
    const key = `${stat.method} ${stat.url}`;
    groups.set(key, [...(groups.get(key) ?? []), stat]);
  }
  return [...groups.values()].map((group) => {
    const count = group.reduce((sum, item) => sum + item.count, 0);
    const weighted = (pick: (item: RequestStat) => number) =>
      count ? group.reduce((sum, item) => sum + pick(item) * item.count, 0) / count : 0;
    return {
      url: group[0]!.url,
      method: group[0]!.method,
      count,
      p50: weighted((item) => item.p50),
      p95: weighted((item) => item.p95),
      p99: weighted((item) => item.p99),
      errorRate: weighted((item) => item.errorRate),
    };
  });
}

function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? round(((current - previous) / previous) * 100) : null;
}

export function trendOf(current: RequestStat, previous?: RequestStat): EndpointTrend {
  if (!previous || previous.count < TREND_MIN_REQUESTS || current.count < TREND_MIN_REQUESTS) {
    return { status: "new", p95ChangePct: null, errorRateChange: null, countChangePct: previous ? percentChange(current.count, previous.count) : null };
  }
  const p95Delta = current.p95 - previous.p95;
  const errorDelta = current.errorRate - previous.errorRate;
  const latencyMoved = Math.abs(p95Delta) >= TREND_LATENCY_MIN_MS && Math.abs(p95Delta) / previous.p95 >= TREND_LATENCY_CHANGE;
  const regressing = (latencyMoved && p95Delta > 0) || errorDelta >= TREND_ERROR_POINTS;
  const improving = (latencyMoved && p95Delta < 0) || errorDelta <= -TREND_ERROR_POINTS;
  return {
    status: regressing ? "regressing" : improving ? "improving" : "steady",
    p95ChangePct: percentChange(current.p95, previous.p95),
    errorRateChange: round(errorDelta, 2),
    countChangePct: percentChange(current.count, previous.count),
  };
}

export function assessEndpoints(current: RequestStat[], previous: RequestStat[]): ProjectHealth {
  const before = new Map(mergeStats(previous).map((stat) => [`${stat.method} ${stat.url}`, stat]));
  const endpoints: EndpointHealth[] = mergeStats(current)
    .map((stat) => {
      const score = scoreEndpoint(stat);
      return { ...stat, p50: round(stat.p50), p95: round(stat.p95), p99: round(stat.p99), errorRate: round(stat.errorRate, 2), score, grade: gradeOf(score), trend: trendOf(stat, before.get(`${stat.method} ${stat.url}`)) };
    })
    .sort((a, b) => a.score - b.score || b.count - a.count);
  const total = endpoints.reduce((sum, item) => sum + item.count, 0);
  if (!total) return { score: null, grade: null, endpoints };
  const score = Math.round(endpoints.reduce((sum, item) => sum + item.score * item.count, 0) / total);
  return { score, grade: gradeOf(score), endpoints };
}
