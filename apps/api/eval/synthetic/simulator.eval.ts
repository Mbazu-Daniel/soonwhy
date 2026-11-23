import { describe, expect, it } from "vitest";
import { applyDistortion } from "./distortions";
import { createRandom } from "./rng";
import { FAULT_SCENARIOS } from "./scenarios";
import { simulate } from "./simulator";
import { TOPOLOGIES, SIX_SERVICES } from "./topologies";
import type { CaseSpec } from "./types";

const plain: CaseSpec = {
  id: "plain",
  truth: [],
  faults: {},
  absorbers: [],
  retries: 0,
  distortion: { sampleDrop: 0, skewMs: 0, orphanRate: 0 },
  benign: { workScale: 1, noisy: false },
};

const run = (spec: CaseSpec, seed = 1, topology = SIX_SERVICES) => simulate(topology, spec, createRandom(seed));
const serversOf = (spans: ReturnType<typeof run>["spans"], service: string) => spans.filter((span) => span.service === service && span.kind === "server");

describe("simulator", () => {
  it("is deterministic for a seed", () => {
    expect(run(plain, 5).spans).toEqual(run(plain, 5).spans);
    expect(run(plain, 5).spans).not.toEqual(run(plain, 6).spans);
  });

  it("builds a connected trace: every non-root span has its parent in the same trace", () => {
    const { spans } = run(plain);
    const ids = new Set(spans.map((span) => span.spanId));
    const roots = spans.filter((span) => span.parentSpanId === undefined);
    expect(roots.every((span) => span.service === "gateway" && span.kind === "server")).toBe(true);
    expect(spans.filter((span) => span.parentSpanId && !ids.has(span.parentSpanId))).toEqual([]);
  });

  it("orders spans by end time and covers every service in a healthy run", () => {
    const { spans } = run(plain);
    expect(spans.map((span) => span.end)).toEqual(spans.map((span) => span.end).sort((a, b) => a - b));
    expect(new Set(spans.map((span) => span.service))).toEqual(new Set(Object.keys(SIX_SERVICES.services)));
  });

  it("adds the injected delay only after onset, and only at the target", () => {
    const { spans, onset } = run({ ...plain, faults: { db: { delayMs: 400 } } });
    const dbBefore = serversOf(spans, "db").filter((span) => span.start < onset);
    const dbAfter = serversOf(spans, "db").filter((span) => span.start >= onset);
    const avg = (list: typeof dbAfter) => list.reduce((sum, span) => sum + span.end - span.start, 0) / list.length;
    expect(avg(dbBefore)).toBeLessThan(30);
    expect(avg(dbAfter)).toBeGreaterThan(350);
    const fraudAfter = serversOf(spans, "fraud").filter((span) => span.start >= onset);
    expect(avg(fraudAfter)).toBeLessThan(40);
  });

  it("makes callers fail when the target fails, and not when the caller absorbs", () => {
    const failing = { ...plain, faults: { db: { errorRate: 1 } } };
    const failed = run(failing);
    const propagated = failed.spans.filter((span) => span.start >= failed.onset);
    expect(propagated.filter((span) => span.service === "gateway" && span.kind === "server").every((span) => span.error)).toBe(true);
    const absorbed = run({ ...failing, absorbers: ["orders", "inventory"] });
    const gatewayErrors = serversOf(absorbed.spans, "gateway").filter((span) => span.error);
    expect(gatewayErrors).toHaveLength(0);
    expect(serversOf(absorbed.spans, "db").some((span) => span.error)).toBe(true);
  });

  it("retries a failing call and amplifies the callee's span count", () => {
    const failing = { ...plain, faults: { fraud: { errorRate: 1 } } };
    const without = run(failing).spans.filter((span) => span.service === "fraud" && span.kind === "server").length;
    const withRetries = run({ ...failing, retries: 2 }).spans.filter((span) => span.service === "fraud" && span.kind === "server").length;
    expect(withRetries).toBeGreaterThan(without * 2);
  });

  it("builds every topology with the right size and only known targets", () => {
    expect(TOPOLOGIES.map((topology) => Object.keys(topology.services).length)).toEqual([6, 12, 9]);
    for (const topology of TOPOLOGIES) {
      const names = new Set(Object.keys(topology.services));
      for (const spec of Object.values(topology.services)) for (const step of spec.steps) for (const edge of step.calls) expect(names.has(edge.target)).toBe(true);
      for (const target of [...topology.targets, ...topology.pairs.flat()]) expect(names.has(target)).toBe(true);
      expect(run(plain, 3, topology).spans.length).toBeGreaterThan(0);
    }
  });

  it("builds the scenario cases with truth that names a service that exists", () => {
    for (const topology of TOPOLOGIES) {
      for (const scenario of FAULT_SCENARIOS) {
        const cases = scenario.build(topology);
        expect(cases.length * scenario.reps).toBeGreaterThanOrEqual(30);
        for (const spec of cases) for (const truth of spec.truth) expect(Object.keys(topology.services)).toContain(truth);
      }
    }
  });
});

describe("distortions", () => {
  const { spans } = run(plain);

  it("drops about the requested share of spans", () => {
    const kept = applyDistortion(spans, { sampleDrop: 0.5, skewMs: 0, orphanRate: 0 }, createRandom(2));
    expect(kept.length / spans.length).toBeGreaterThan(0.45);
    expect(kept.length / spans.length).toBeLessThan(0.55);
  });

  it("leaves dangling parents when orphaning, and none otherwise", () => {
    const dangling = (list: typeof spans) => {
      const ids = new Set(list.map((span) => span.spanId));
      return list.filter((span) => span.parentSpanId && !ids.has(span.parentSpanId)).length;
    };
    expect(dangling(applyDistortion(spans, { sampleDrop: 0, skewMs: 0, orphanRate: 0.3 }, createRandom(2)))).toBeGreaterThan(0);
    expect(dangling(applyDistortion(spans, { sampleDrop: 0, skewMs: 0, orphanRate: 0 }, createRandom(2)))).toBe(0);
  });

  it("shifts every span of a service by one constant offset within the skew bound", () => {
    const skewed = applyDistortion(spans, { sampleDrop: 0, skewMs: 500, orphanRate: 0 }, createRandom(2));
    const byId = new Map(spans.map((span) => [span.spanId, span]));
    const offsets = new Map<string, Set<number>>();
    for (const span of skewed) {
      const shift = Math.round((span.start - byId.get(span.spanId)!.start) * 1000) / 1000;
      offsets.set(span.service, (offsets.get(span.service) ?? new Set()).add(shift));
      expect(Math.abs(shift)).toBeLessThanOrEqual(500);
    }
    for (const set of offsets.values()) expect(set.size).toBe(1);
  });
});
