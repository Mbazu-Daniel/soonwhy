import { Analyzer } from "../analyzer";
import type { SpanRecord } from "../types";
import { MS_PER_HOUR, SOAK_ANALYZE_INTERVAL_MS, SOAK_DIURNAL_AMPLITUDE, SOAK_HOURS, SOAK_REQUEST_INTERVAL_MS, SOAK_SEED, START_EPOCH_MS } from "./constants";
import { createRandom } from "./rng";
import { simulate } from "./simulator";
import type { CaseSpec, Fault, SoakResult, Topology } from "./types";

const ANALYZER_OPTIONS = { baselineWindow: 100, recentWindow: 10, errorWindow: 20, traceWindow: 40, traceMode: "production" } as const;
const HEALTHY: CaseSpec = { id: "soak", truth: [], faults: {}, absorbers: [], retries: 0, distortion: { sampleDrop: 0, skewMs: 0, orphanRate: 0 }, benign: { workScale: 1, noisy: false } };

function diurnalScale(elapsedMs: number): number {
  return 1 + SOAK_DIURNAL_AMPLITUDE * Math.sin((2 * Math.PI * elapsedMs) / (24 * MS_PER_HOUR));
}

function requestSpans(topology: Topology, requestIndex: number, elapsedMs: number, seed: number, faults: Record<string, Fault>): SpanRecord[] {
  const spec: CaseSpec = { ...HEALTHY, faults, benign: { workScale: diurnalScale(elapsedMs), noisy: false } };
  const { spans } = simulate(topology, spec, createRandom(seed + requestIndex), { warmup: 0, requests: 1 });
  const shift = START_EPOCH_MS + elapsedMs - Math.min(...spans.map((span) => span.start));
  return spans.map((span) => ({ ...span, traceId: `soak-${requestIndex}`, start: span.start + shift, end: span.end + shift }));
}

export interface SoakFault {
  fromRequest: number;
  faults: Record<string, Fault>;
}

export function runSoak(topology: Topology, hours = SOAK_HOURS, injected?: SoakFault): SoakResult {
  const analyzer = new Analyzer(ANALYZER_OPTIONS);
  const totalMs = hours * MS_PER_HOUR;
  const requests = Math.floor(totalMs / SOAK_REQUEST_INTERVAL_MS);
  let nextTick = START_EPOCH_MS + SOAK_ANALYZE_INTERVAL_MS;
  let episodes = 0;
  let previousTickHadFinding = false;
  let snapshotsSeen = 0;

  const tick = (at: number) => {
    const snapshot = analyzer.analyze(at);
    if (snapshot) {
      snapshotsSeen += 1;
      if (!previousTickHadFinding) episodes += 1;
    }
    previousTickHadFinding = snapshot !== undefined;
  };

  for (let request = 0; request < requests; request++) {
    const elapsed = request * SOAK_REQUEST_INTERVAL_MS;
    for (const span of requestSpans(topology, request, elapsed, SOAK_SEED, injected && request >= injected.fromRequest ? injected.faults : {}).sort((a, b) => a.end - b.end)) {
      while (span.end >= nextTick) {
        tick(nextTick);
        nextTick += SOAK_ANALYZE_INTERVAL_MS;
      }
      analyzer.ingest(span);
    }
  }

  return { topology: topology.name, hours, requests, findingEpisodes: episodes, episodesPerHour: episodes / hours, snapshotsPerHour: snapshotsSeen / hours };
}
