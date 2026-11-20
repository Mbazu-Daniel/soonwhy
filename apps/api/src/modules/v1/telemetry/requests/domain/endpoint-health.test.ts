import { describe, expect, it } from "vitest";
import { assessEndpoints, gradeOf, mergeStats, scoreEndpoint, trendOf } from "./endpoint-health";
import type { RequestStat } from "./requests.repository.types";

const stat = (over: Partial<RequestStat> = {}): RequestStat => ({ url: "/orders", method: "GET", count: 100, p50: 50, p95: 150, p99: 200, errorRate: 0, ...over });

describe("scoreEndpoint", () => {
  it("gives a fast, error-free endpoint full marks", () => {
    expect(scoreEndpoint(stat())).toBe(100);
  });

  it("loses points for slowness, errors and a long tail independently", () => {
    expect(scoreEndpoint(stat({ p95: 2000 }))).toBe(50);
    expect(scoreEndpoint(stat({ errorRate: 10 }))).toBe(60);
    expect(scoreEndpoint(stat({ p50: 10, p99: 500 }))).toBe(90);
    expect(scoreEndpoint(stat({ p95: 5000, errorRate: 50, p50: 10, p99: 1000 }))).toBe(0);
  });

  it("does not punish an endpoint with no median", () => {
    expect(scoreEndpoint(stat({ p50: 0, p99: 0 }))).toBe(100);
  });
});

describe("gradeOf", () => {
  it.each([[95, "A"], [90, "A"], [80, "B"], [60, "C"], [45, "D"], [10, "F"]])("%i is %s", (score, grade) => {
    expect(gradeOf(score)).toBe(grade);
  });
});

describe("mergeStats", () => {
  it("combines rows for the same route, weighting by request count", () => {
    const [merged] = mergeStats([stat({ count: 100, p95: 100, errorRate: 0 }), stat({ count: 300, p95: 300, errorRate: 4 })]);
    expect(merged).toMatchObject({ count: 400, p95: 250, errorRate: 3 });
  });

  it("keeps methods apart", () => {
    expect(mergeStats([stat(), stat({ method: "POST" })])).toHaveLength(2);
  });
});

describe("trendOf", () => {
  it("is new without a previous window or enough traffic", () => {
    expect(trendOf(stat()).status).toBe("new");
    expect(trendOf(stat(), stat({ count: 3 })).status).toBe("new");
  });

  it("flags a latency jump or error rise as regressing, and the reverse as improving", () => {
    expect(trendOf(stat({ p95: 400 }), stat({ p95: 200 }))).toMatchObject({ status: "regressing", p95ChangePct: 100 });
    expect(trendOf(stat({ errorRate: 5 }), stat({ errorRate: 1 }))).toMatchObject({ status: "regressing", errorRateChange: 4 });
    expect(trendOf(stat({ p95: 100 }), stat({ p95: 300 })).status).toBe("improving");
    expect(trendOf(stat({ errorRate: 0 }), stat({ errorRate: 3 })).status).toBe("improving");
  });

  it("ignores small or tiny-absolute changes", () => {
    expect(trendOf(stat({ p95: 110 }), stat({ p95: 100 })).status).toBe("steady");
    expect(trendOf(stat({ p95: 40 }), stat({ p95: 20 })).status).toBe("steady");
  });
});

describe("assessEndpoints", () => {
  it("lists the worst endpoint first and weights the project score by traffic", () => {
    const current = [stat({ url: "/health", count: 900 }), stat({ url: "/report", count: 100, p95: 2000, errorRate: 10, p50: 100, p99: 3000 })];
    const result = assessEndpoints(current, []);
    expect(result.endpoints.map((e) => e.url)).toEqual(["/report", "/health"]);
    expect(result.endpoints[0]!.grade).toBe("F");
    expect(result.score).toBe(Math.round((100 * 900 + result.endpoints[0]!.score * 100) / 1000));
  });

  it("has no score when there was no traffic", () => {
    expect(assessEndpoints([], [])).toEqual({ score: null, grade: null, endpoints: [] });
  });
});
