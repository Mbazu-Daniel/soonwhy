import { Analyzer } from "../analyzer";
import type { AnalysisSnapshot, RankedService } from "../types";
import { ANALYZE_INTERVAL_MS, SEED_BASE, SETTLE_MS, TUNING_REPS_PER_TEN } from "./constants";
import { applyDistortion } from "./distortions";
import { createRandom, hashLabel } from "./rng";
import { simulate } from "./simulator";
import type { CaseSpec, MethodName, RunRow, Split, Topology } from "./types";

export const METHODS: MethodName[] = ["full", "anomalyOnly", "criticalPathOnly", "errorPropagationOnly", "firstError", "mostErrors"];

const ANALYZER_OPTIONS = { baselineWindow: 100, recentWindow: 10, errorWindow: 20, traceWindow: 40, traceMode: "production" } as const;

export function splitOf(rep: number): Split {
  return rep % 10 < TUNING_REPS_PER_TEN ? "tuning" : "locked";
}

export function seedFor(topology: Topology, spec: CaseSpec, rep: number): number {
  return (hashLabel(`${topology.name}/${spec.id}/${rep}`) ^ SEED_BASE) >>> 0;
}

function pessimisticRank(list: RankedService[], service: string): number | null {
  const hit = list.find((entry) => entry.service === service);
  if (!hit) return null;
  return list.filter((entry) => entry.score >= hit.score).length;
}

function rankOfTruth(list: RankedService[], truth: string[]): number | null {
  const ranks = truth.map((service) => pessimisticRank(list, service)).filter((rank): rank is number => rank !== null);
  return ranks.length === 0 ? null : Math.min(...ranks);
}

function worstRankOfTruth(list: RankedService[] | undefined, truth: string[]): number | null {
  if (!list) return null;
  const ranks = truth.map((service) => pessimisticRank(list, service));
  return ranks.some((rank) => rank === null) ? null : Math.max(...(ranks as number[]));
}

function ranksFor(snapshot: AnalysisSnapshot | undefined, truth: string[]): Record<MethodName, number | null> {
  return Object.fromEntries(METHODS.map((method) => [method, snapshot ? rankOfTruth(snapshot[method], truth) : null])) as Record<MethodName, number | null>;
}

function replay(analyzer: Analyzer, spans: ReturnType<typeof simulate>["spans"], lastEnd: number): void {
  let nextTick = spans[0]!.end + ANALYZE_INTERVAL_MS;
  for (const span of spans) {
    while (span.end >= nextTick) {
      analyzer.analyze(nextTick);
      nextTick += ANALYZE_INTERVAL_MS;
    }
    analyzer.ingest(span);
  }
  analyzer.analyze(lastEnd + SETTLE_MS);
}

export function runCase(topology: Topology, spec: CaseSpec, scenario: string, rep: number): RunRow {
  const seed = seedFor(topology, spec, rep);
  const random = createRandom(seed);
  const { spans, onset, lastEnd } = simulate(topology, spec, random);
  const analyzer = new Analyzer(ANALYZER_OPTIONS);
  replay(analyzer, applyDistortion(spans, spec.distortion, random), lastEnd);

  const preOnset = analyzer.snapshots.filter((snapshot) => snapshot.at < onset);
  const post = analyzer.snapshots.filter((snapshot) => snapshot.at >= onset);
  const first = post[0];
  const last = post.at(-1);

  return {
    topology: topology.name,
    scenario,
    caseId: spec.id,
    rep,
    seed,
    split: splitOf(rep),
    truth: spec.truth,
    detected: post.length > 0,
    preOnsetFinding: preOnset.length > 0,
    falseAlarm: analyzer.snapshots.length > 0,
    initialRank: ranksFor(first, spec.truth),
    finalRank: ranksFor(last, spec.truth),
    fullWorstTruthRank: worstRankOfTruth(last?.full, spec.truth),
    confidence: last?.fullConfidence ?? null,
    coverage: last?.fullCoverage ?? null,
  };
}
