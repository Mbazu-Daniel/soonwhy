import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { Analyzer } from "./analyzer";
import { Cluster, closedLoop, type Fault, type ServiceName } from "./cluster";
import type { RankedService } from "./types";

const REPS = Number(process.env.EVAL_REPS ?? 6);
const NORMAL_RUNS = Number(process.env.EVAL_NORMAL_RUNS ?? 24);
const WARMUP_REQUESTS = 100;
const FAULT_REQUESTS = 120;

interface Scenario {
  name: string;
  fault: Fault;
  targets: ServiceName[];
}

const SCENARIOS: Scenario[] = [
  { name: "serial_delay", fault: { delayMs: 400 }, targets: ["db", "fraud", "orders"] },
  { name: "error_rate", fault: { errorRate: 0.4 }, targets: ["fraud", "db", "inventory"] },
  { name: "contention", fault: { spinMs: 300 }, targets: ["inventory", "payments", "orders"] },
  { name: "fanout_delay", fault: { delayMs: 500 }, targets: ["inventory", "payments"] },
];

const METHODS = ["full", "anomalyOnly", "criticalPathOnly", "firstError"] as const;

function pessimisticRank(list: RankedService[], truth: string): number | undefined {
  const hit = list.find((r) => r.service === truth);
  if (!hit) return undefined;
  return list.filter((r) => r.score >= hit.score).length;
}

describe("controlled fault-injection evaluation", () => {
  const cluster = new Cluster();
  let analyzer = new Analyzer();
  let gatewayEnds: number[] = [];

  beforeAll(async () => {
    cluster.onSpan = (span) => {
      analyzer.ingest(span);
      if (span.service === "gateway" && span.kind === "server") gatewayEnds.push(span.end);
    };
    await cluster.start();
  });
  afterAll(() => cluster.stop());

  async function runOnce(scenario: string, target: ServiceName | null, fault: Fault, seed: number) {
    analyzer = new Analyzer();
    gatewayEnds = [];
    await cluster.reset(seed);
    const timer = setInterval(() => analyzer.analyze(Date.now()), 500);
    await closedLoop(WARMUP_REQUESTS, 3);
    await new Promise((r) => setTimeout(r, 600));
    const preOnsetFinding = analyzer.snapshots.length > 0;

    const onset = Date.now();
    if (target) await cluster.setFault(target, fault);
    await closedLoop(FAULT_REQUESTS, 3);
    await new Promise((r) => setTimeout(r, 1200));
    clearInterval(timer);
    analyzer.analyze(Date.now());
    await cluster.reset(seed);

    const post = analyzer.snapshots.filter((s) => s.at >= onset);
    const first = post[0];
    const last = post.at(-1);
    const row: Record<string, unknown> = {
      scenario,
      target,
      seed,
      detected: post.length > 0,
      preOnsetFinding,
      detectionMs: first ? first.at - onset : null,
      requestsToDetect: first ? gatewayEnds.filter((e) => e >= onset && e <= first.at).length : null,
      findingServices: last?.findingServices ?? [],
    };
    if (target) {
      for (const m of METHODS) {
        row[`${m}_initialRank`] = first ? (pessimisticRank(first[m], target) ?? null) : null;
        row[`${m}_finalRank`] = last ? (pessimisticRank(last[m], target) ?? null) : null;
      }
      row.finalRanking = last?.full ?? [];
    }
    return row;
  }

  it("runs every scenario and the no-fault control", async () => {
    const rows: Record<string, unknown>[] = [];
    let seed = 1000;
    for (const scenario of SCENARIOS) {
      for (const target of scenario.targets) {
        for (let rep = 0; rep < REPS; rep++) {
          seed += 1;
          const row = await runOnce(scenario.name, target, scenario.fault, seed);
          rows.push(row);
          console.log(`[${rows.length}] ${scenario.name}/${target} rep${rep} detected=${row.detected} detectMs=${row.detectionMs} fullRank=${row.full_finalRank}`);
        }
      }
    }
    for (let i = 0; i < NORMAL_RUNS; i++) {
      seed += 1;
      const row = await runOnce("no_fault", null, {}, seed);
      rows.push(row);
      console.log(`[${rows.length}] no_fault #${i} falseAlarm=${row.detected || row.preOnsetFinding}`);
    }
    mkdirSync(new URL("./results", import.meta.url).pathname, { recursive: true });
    writeFileSync(new URL(process.env.EVAL_TRACE_MODE === "production" ? "./results/accuracy-production.json" : process.env.EVAL_TRACE_MODE === "full" ? "./results/accuracy-selftime.json" : "./results/accuracy.json", import.meta.url).pathname, JSON.stringify({ config: { traceMode: process.env.EVAL_TRACE_MODE ?? "servers", REPS, NORMAL_RUNS, WARMUP_REQUESTS, FAULT_REQUESTS }, rows }, null, 2));
  });
});
