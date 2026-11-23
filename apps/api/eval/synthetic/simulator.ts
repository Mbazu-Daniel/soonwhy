import type { SpanRecord } from "../types";
import {
  CONCURRENCY,
  FAULT_REQUESTS,
  JITTER_LOW,
  JITTER_SPAN,
  NETWORK_MS,
  NOISY_JITTER_LOW,
  NOISY_JITTER_SPAN,
  REQUEST_GAP_MS,
  RETRY_BACKOFF_MS,
  START_EPOCH_MS,
  WARMUP_REQUESTS,
} from "./constants";
import type { Random } from "./rng";
import type { CaseSpec, Edge, Topology } from "./types";

interface Context {
  topology: Topology;
  spec: CaseSpec;
  random: Random;
  spans: SpanRecord[];
  traceId: string;
  counter: { value: number };
  faultsActive: boolean;
}

interface CallResult {
  end: number;
  failed: boolean;
}

export interface Shape {
  warmup: number;
  requests: number;
}

const DEFAULT_SHAPE: Shape = { warmup: WARMUP_REQUESTS, requests: FAULT_REQUESTS };

export interface Simulation {
  spans: SpanRecord[];
  onset: number;
  lastEnd: number;
}

function jitter(context: Context, milliseconds: number): number {
  const noisy = context.spec.benign.noisy;
  const low = noisy ? NOISY_JITTER_LOW : JITTER_LOW;
  const span = noisy ? NOISY_JITTER_SPAN : JITTER_SPAN;
  return milliseconds * (low + context.random() * span);
}

function nextId(context: Context): string {
  context.counter.value += 1;
  return context.counter.value.toString(16).padStart(16, "0");
}

function callClient(context: Context, caller: string, edge: Edge, start: number, parentSpanId: string): CallResult {
  let attemptStart = start;
  let result: CallResult = { end: start, failed: false };
  for (let attempt = 0; attempt <= context.spec.retries; attempt++) {
    const spanId = nextId(context);
    result = callService(context, edge.target, attemptStart + NETWORK_MS, spanId);
    const end = result.end + NETWORK_MS;
    context.spans.push({
      service: caller,
      traceId: context.traceId,
      spanId,
      parentSpanId,
      name: `call ${edge.target}`,
      kind: "client",
      peer: edge.target,
      start: attemptStart,
      end,
      error: result.failed,
    });
    result = { end, failed: result.failed };
    if (!result.failed) return result;
    attemptStart = end + RETRY_BACKOFF_MS;
  }
  return result;
}

function runSteps(context: Context, service: string, start: number, serverSpanId: string): CallResult {
  const absorbs = context.spec.absorbers.includes(service);
  let time = start;
  for (const step of context.topology.services[service]!.steps) {
    const results: CallResult[] = [];
    let cursor = time;
    for (const edge of step.calls) {
      const result = callClient(context, service, edge, step.parallel ? time : cursor, serverSpanId);
      results.push(result);
      cursor = result.end;
    }
    time = Math.max(...results.map((result) => result.end));
    if (results.some((result) => result.failed) && !absorbs) return { end: time, failed: true };
  }
  return { end: time, failed: false };
}

function callService(context: Context, service: string, start: number, parentSpanId: string | undefined): CallResult {
  const spec = context.topology.services[service]!;
  const serverSpanId = nextId(context);
  const fault = context.faultsActive ? context.spec.faults[service] : undefined;
  const scale = context.faultsActive ? context.spec.benign.workScale : 1;
  let time = start + jitter(context, spec.work * scale);
  if (fault?.spinMs) time += fault.spinMs;
  if (fault?.delayMs) time += jitter(context, fault.delayMs);
  const injected = fault?.errorRate !== undefined && context.random() < fault.errorRate;
  const result = injected ? { end: time, failed: true } : runSteps(context, service, time, serverSpanId);
  context.spans.push({
    service,
    traceId: context.traceId,
    spanId: serverSpanId,
    parentSpanId,
    name: `${service} handle`,
    kind: "server",
    start,
    end: result.end,
    error: result.failed,
  });
  return result;
}

export function simulate(topology: Topology, spec: CaseSpec, random: Random, shape: Shape = DEFAULT_SHAPE): Simulation {
  const spans: SpanRecord[] = [];
  const counter = { value: 0 };
  const lanes = Array.from({ length: CONCURRENCY }, (_, lane) => START_EPOCH_MS + lane * REQUEST_GAP_MS);
  let onset = START_EPOCH_MS;
  let lastEnd = START_EPOCH_MS;

  for (let request = 0; request < shape.warmup + shape.requests; request++) {
    const lane = lanes.indexOf(Math.min(...lanes));
    const start = lanes[lane]!;
    if (request === shape.warmup) onset = start;
    const context: Context = { topology, spec, random, spans, traceId: `trace-${request}`, counter, faultsActive: request >= shape.warmup };
    const result = callService(context, topology.entry, start, undefined);
    lanes[lane] = result.end + REQUEST_GAP_MS;
    lastEnd = Math.max(lastEnd, result.end);
  }

  spans.sort((a, b) => a.end - b.end);
  return { spans, onset, lastEnd };
}
