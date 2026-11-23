import { evaluateSignal } from "../src/modules/v1/detection/detections/domain/detection.engine";
import { RootCauseRanker } from "../src/modules/v1/detection/detections/root-cause/root-cause.ranker";
import type {
  ErrorData,
  RankingInput,
  TraceSpan,
} from "../src/modules/v1/detection/detections/root-cause/root-cause.ranker.types";
import type { ScoringWeights } from "../src/modules/v1/detection/detections/root-cause/root-cause.types";
import { DEFAULT_WEIGHTS } from "../src/modules/v1/detection/detections/root-cause/root-cause.types";
import { buildRankingInputs } from "../src/modules/v1/detection/detections/root-cause/root-cause.inputs";
import type { AnalysisSnapshot, AnalyzerOptions, RankedService, SpanRecord } from "./types";

export const DEFAULT_OPTIONS: AnalyzerOptions = {
  baselineWindow: Number(process.env.EVAL_BASELINE_WINDOW ?? 100),
  recentWindow: Number(process.env.EVAL_RECENT_WINDOW ?? 10),
  errorWindow: 20,
  traceWindow: 40,
  traceMode: process.env.EVAL_TRACE_MODE === "production" ? "production" : process.env.EVAL_TRACE_MODE === "full" ? "full" : "servers",
};

const ANOMALY_ONLY: ScoringWeights = { anomalySeverity: 1, graphPosition: 0, criticalPathContribution: 0, errorPropagation: 0 };
const ERROR_PROPAGATION_ONLY: ScoringWeights = { anomalySeverity: 0, graphPosition: 0, criticalPathContribution: 0, errorPropagation: 1 };
const CRITICAL_PATH_ONLY: ScoringWeights = { anomalySeverity: 0, graphPosition: 0, criticalPathContribution: 1, errorPropagation: 0 };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

interface ServiceState {
  baselineDurations: number[];
  baselineErrors: number[];
  recent: { dur: number; err: boolean; start: number; traceId: string }[];
  pending: { dur: number; err: boolean }[];
  anomalous: boolean;
  firstAnomalyAt?: number;
}

export class Analyzer {
  private ranker = new RootCauseRanker();
  private services = new Map<string, ServiceState>();
  private edges = new Map<string, Set<string>>();
  private traces = new Map<string, SpanRecord[]>();
  private traceOrder: string[] = [];
  private errorLog: ErrorData[] = [];
  cpuMicros = 0;
  spansSeen = 0;
  firstFindingAt?: number;
  firstRankingAt?: number;
  snapshots: AnalysisSnapshot[] = [];

  constructor(private options: AnalyzerOptions = DEFAULT_OPTIONS) {}

  ingest(span: SpanRecord): void {
    const c0 = process.cpuUsage();
    this.spansSeen += 1;
    const list = this.traces.get(span.traceId);
    if (list) list.push(span);
    else {
      this.traces.set(span.traceId, [span]);
      this.traceOrder.push(span.traceId);
      if (this.traceOrder.length > 400) this.traces.delete(this.traceOrder.shift()!);
    }

    if (span.kind === "client" && span.peer) {
      if (!this.edges.has(span.service)) this.edges.set(span.service, new Set());
      this.edges.get(span.service)!.add(span.peer);
    }
    if (span.kind === "server") {
      const state = this.state(span.service);
      const dur = span.end - span.start;
      state.recent.push({ dur, err: span.error, start: span.start, traceId: span.traceId });
      if (state.recent.length > Math.max(this.options.recentWindow, this.options.errorWindow)) state.recent.shift();
      state.pending.push({ dur, err: span.error });
      if (span.error) {
        this.errorLog.push({ timestamp: new Date(span.end).toISOString(), serviceName: span.service, traceId: span.traceId, errorMessage: "span status ERROR" });
        if (this.errorLog.length > 300) this.errorLog.shift();
      }
    }
    const c1 = process.cpuUsage(c0);
    this.cpuMicros += c1.user + c1.system;
  }

  analyze(now: number): AnalysisSnapshot | undefined {
    const c0 = process.cpuUsage();
    const findings: RankingInput["findings"] = [];

    for (const [service, state] of this.services) {
      if (state.pending.length === 0 && !state.anomalous) continue;
      const lat = state.recent.slice(-this.options.recentWindow);
      const err = state.recent.slice(-this.options.errorWindow);
      const baseLatency = mean(state.baselineDurations);
      const baseErrorPct = mean(state.baselineErrors) * 100;
      const samples = state.baselineDurations.length;
      let flagged = false;

      if (lat.length >= 5) {
        const sig = evaluateSignal("latency", mean(lat.map((s) => s.dur)), { value: baseLatency, samples });
        if (sig) {
          flagged = true;
          findings.push({ id: `${service}-latency`, type: "latency", serviceName: service, timestamp: new Date(now).toISOString(), severity: sig.severity, observedValue: sig.observedValue, baselineValue: baseLatency });
        }
      }
      if (err.length >= 10) {
        const sig = evaluateSignal("error_rate", (err.filter((s) => s.err).length / err.length) * 100, { value: baseErrorPct, samples });
        if (sig) {
          flagged = true;
          findings.push({ id: `${service}-errors`, type: "error_rate", serviceName: service, timestamp: new Date(now).toISOString(), severity: sig.severity, observedValue: sig.observedValue, baselineValue: Math.max(baseErrorPct, 1) });
        }
      }

      if (flagged) {
        state.anomalous = true;
        state.firstAnomalyAt ??= now;
      } else {
        state.anomalous = false;
        for (const p of state.pending) {
          state.baselineDurations.push(p.dur);
          state.baselineErrors.push(p.err ? 1 : 0);
        }
        state.baselineDurations = state.baselineDurations.slice(-this.options.baselineWindow);
        state.baselineErrors = state.baselineErrors.slice(-this.options.baselineWindow);
      }
      state.pending = [];
    }

    let snapshot: AnalysisSnapshot | undefined;
    if (findings.length > 0) {
      this.firstFindingAt ??= now;
      snapshot = this.rank(findings, now);
      this.firstRankingAt ??= Date.now();
      this.snapshots.push(snapshot);
    }
    const c1 = process.cpuUsage(c0);
    this.cpuMicros += c1.user + c1.system;
    return snapshot;
  }

  private state(service: string): ServiceState {
    let s = this.services.get(service);
    if (!s) {
      s = { baselineDurations: [], baselineErrors: [], recent: [], pending: [], anomalous: false };
      this.services.set(service, s);
    }
    return s;
  }

  private dependencyMap() {
    const map = new Map<string, { upstream: string[]; downstream: string[] }>();
    const names = new Set<string>(this.edges.keys());
    for (const targets of this.edges.values()) for (const t of targets) names.add(t);
    for (const name of names) {
      map.set(name, {
        upstream: [...(this.edges.get(name) ?? [])],
        downstream: [...this.edges].filter(([, t]) => t.has(name)).map(([caller]) => caller),
      });
    }
    return map;
  }

  private recentTraces(): TraceSpan[][] {
    const out: TraceSpan[][] = [];
    for (const id of this.traceOrder.slice(-this.options.traceWindow)) {
      const spans = this.traces.get(id) ?? [];
      const servers = spans.filter((s) => s.kind === "server");
      if (servers.length === 0) continue;
      const critical = criticalPathSpanIds(spans);
      const included = this.options.traceMode === "full" ? spans : servers;
      out.push(included.map((s) => ({ spanId: s.spanId, serviceName: s.service, operationName: s.name, duration: s.end - s.start, startTime: s.start, parentSpanId: s.parentSpanId, isCriticalPath: critical.has(s.spanId) })));
    }
    return out;
  }

  private productionInputs() {
    const recent = this.traceOrder.slice(-this.options.traceWindow).map((id) =>
      (this.traces.get(id) ?? []).map((s) => ({
        traceId: s.traceId,
        spanId: s.spanId,
        parentSpanId: s.parentSpanId,
        name: s.name,
        duration: s.end - s.start,
        timestamp: new Date(s.start).toISOString(),
        service: s.service,
        statusCode: s.error ? 2 : 1,
      })),
    );
    return buildRankingInputs(recent);
  }

  private rank(findings: RankingInput["findings"], now: number): AnalysisSnapshot {
    const errors = this.errorLog.filter((e) => Date.parse(e.timestamp) >= (this.earliestAnomaly() ?? 0) - 2000);
    const input: RankingInput = this.options.traceMode === "production" ? { findings, ...this.productionInputs() } : { findings, traces: this.recentTraces(), errors, dependencyMap: this.dependencyMap() };
    const toList = (weights: ScoringWeights): RankedService[] =>
      this.ranker.rank({ ...input, weights }).candidates.filter((c) => c.candidateType === "service").map((c) => ({ service: c.serviceName, score: c.score }));
    const fullResult = this.ranker.rank({ ...input, weights: DEFAULT_WEIGHTS });
    const full = fullResult.candidates.filter((c) => c.candidateType === "service").map((c) => ({ service: c.serviceName, score: c.score }));
    const errorCounts = new Map<string, number>();
    for (const e of errors) errorCounts.set(e.serviceName, (errorCounts.get(e.serviceName) ?? 0) + 1);

    const firstErrorByService = new Map<string, number>();
    for (const e of errors) {
      const t = Date.parse(e.timestamp);
      if (!firstErrorByService.has(e.serviceName) || t < firstErrorByService.get(e.serviceName)!) firstErrorByService.set(e.serviceName, t);
    }
    const flaggedServices = [...new Set(findings.map((f) => f.serviceName))];
    const firstError = [...flaggedServices]
      .sort((a, b) => (firstErrorByService.get(a) ?? Infinity) - (firstErrorByService.get(b) ?? Infinity))
      .map((service, i, all) => ({ service, score: firstErrorByService.has(service) ? all.length - i : 0 }));

    const mostErrors = flaggedServices.map((service) => ({ service, score: errorCounts.get(service) ?? 0 }));
    return {
      at: now,
      full,
      anomalyOnly: toList(ANOMALY_ONLY),
      criticalPathOnly: toList(CRITICAL_PATH_ONLY),
      firstError,
      errorPropagationOnly: toList(ERROR_PROPAGATION_ONLY),
      mostErrors,
      fullConfidence: fullResult.confidence,
      fullCoverage: fullResult.overallEvidenceCoverage,
      findingServices: flaggedServices,
    };
  }

  private earliestAnomaly(): number | undefined {
    const times = [...this.services.values()].map((s) => s.firstAnomalyAt).filter((t): t is number => t !== undefined);
    return times.length ? Math.min(...times) : undefined;
  }
}

export function criticalPathSpanIds(spans: SpanRecord[]): Set<string> {
  const byParent = new Map<string, SpanRecord[]>();
  for (const s of spans) if (s.parentSpanId) (byParent.get(s.parentSpanId) ?? byParent.set(s.parentSpanId, []).get(s.parentSpanId)!).push(s);
  const serverOf = new Map<string, SpanRecord[]>();
  for (const s of spans) if (s.kind === "client") serverOf.set(s.spanId, byParent.get(s.spanId)?.filter((c) => c.kind === "server") ?? []);

  const critical = new Set<string>();
  const walk = (server: SpanRecord) => {
    critical.add(server.spanId);
    const calls = (byParent.get(server.spanId) ?? []).filter((c) => c.kind === "client");
    let cursor = server.end;
    const remaining = [...calls].sort((a, b) => b.end - a.end);
    for (const call of remaining) {
      if (call.end <= cursor + 1) {
        for (const child of serverOf.get(call.spanId) ?? []) walk(child);
        cursor = call.start;
      }
    }
  };
  const roots = spans.filter((s) => s.kind === "server" && !spans.some((p) => p.spanId === s.parentSpanId && p.kind === "client"));
  for (const r of roots) walk(r);
  return critical;
}
