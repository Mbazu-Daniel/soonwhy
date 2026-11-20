import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { Analyzer } from "./analyzer";
import { Cluster, openLoop, percentile } from "./cluster";

const RPS = Number(process.env.EVAL_RPS ?? 40);
const SECONDS = Number(process.env.EVAL_SECONDS ?? 20);
const ROUNDS = Number(process.env.EVAL_ROUNDS ?? 3);

describe("analysis-layer overhead", () => {
  const cluster = new Cluster();
  let analyzer: Analyzer | undefined;
  let received = 0;

  beforeAll(async () => {
    cluster.onSpan = (span) => {
      received += 1;
      analyzer?.ingest(span);
    };
    await cluster.start();
  });
  afterAll(() => cluster.stop());

  async function phase(analysis: boolean) {
    analyzer = analysis ? new Analyzer() : undefined;
    received = 0;
    await cluster.reset(7);
    await openLoop(RPS, 3);
    received = 0;
    const timer = analysis ? setInterval(() => analyzer!.analyze(Date.now()), 500) : undefined;
    const appCpu0 = cluster.cpuSeconds();
    const self0 = process.cpuUsage();
    const heap0 = process.memoryUsage();
    const wall0 = performance.now();
    const results = await openLoop(RPS, SECONDS);
    const wall = (performance.now() - wall0) / 1000;
    const self = process.cpuUsage(self0);
    const heap1 = process.memoryUsage();
    if (timer) clearInterval(timer);
    const ms = results.map((r) => r.ms);
    return {
      analysis,
      requests: results.length,
      spansReceived: received,
      failed: results.filter((r) => !r.ok).length,
      appCpuPercent: ((cluster.cpuSeconds() - appCpu0) / wall) * 100,
      appRssMb: cluster.rssMb(),
      harnessCpuPercent: ((self.user + self.system) / 1e6 / wall) * 100,
      analyzerCpuPercent: analysis ? (analyzer!.cpuMicros / 1e6 / wall) * 100 : 0,
      analyzerMicrosPerSpan: analysis && analyzer!.spansSeen ? analyzer!.cpuMicros / analyzer!.spansSeen : 0,
      heapDeltaMb: (heap1.heapUsed - heap0.heapUsed) / 1048576,
      rssMb: heap1.rss / 1048576,
      p50: percentile(ms, 0.5),
      p95: percentile(ms, 0.95),
      p99: percentile(ms, 0.99),
    };
  }

  it("compares the app with and without the analysis layer", async () => {
    const rows = [];
    for (let i = 0; i < ROUNDS; i++) {
      rows.push(await phase(false));
      rows.push(await phase(true));
    }
    mkdirSync(new URL("./results", import.meta.url).pathname, { recursive: true });
    writeFileSync(new URL("./results/overhead.json", import.meta.url).pathname, JSON.stringify({ config: { RPS, SECONDS, ROUNDS }, rows }, null, 2));
    console.log(JSON.stringify(rows, null, 1));
  });
});
