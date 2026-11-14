import {
  MeterProvider,
  PeriodicExportingMetricReader,
  type MetricReader,
} from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { metrics, type Meter } from "@opentelemetry/api";
import { resolveOtlpEndpoint, resolveOtlpHeaders } from "./otlp-config";
import { selfObservabilityEnabled } from "./self-observability";
import { Logger } from "@nestjs/common";

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? "soonwhy-api";

let meter: Meter | null = null;
let httpRequestDuration: ReturnType<Meter["createHistogram"]> | null = null;
let httpRequestCount: ReturnType<Meter["createCounter"]> | null = null;
let httpRequestErrors: ReturnType<Meter["createCounter"]> | null = null;
let dbQueryDuration: ReturnType<Meter["createHistogram"]> | null = null;
let dbQueryCount: ReturnType<Meter["createCounter"]> | null = null;
let detectionRunDuration: ReturnType<Meter["createHistogram"]> | null = null;
let detectionRuns: ReturnType<Meter["createCounter"]> | null = null;
let detectionFindings: ReturnType<Meter["createCounter"]> | null = null;
let aiInvocations: ReturnType<Meter["createCounter"]> | null = null;
let aiTokens: ReturnType<Meter["createCounter"]> | null = null;
let aiEstimatedCostUsd: ReturnType<Meter["createCounter"]> | null = null;
let aiRequestDuration: ReturnType<Meter["createHistogram"]> | null = null;
let prometheusExporter: PrometheusExporter | null = null;

function ensureInstruments() {
  if (meter) return;
  meter = metrics.getMeter(SERVICE_NAME);
  httpRequestDuration = meter.createHistogram("http.server.request.duration", {
    unit: "ms",
  });
  httpRequestCount = meter.createCounter("http.server.request.count", {
    unit: "1",
  });
  httpRequestErrors = meter.createCounter("http.server.request.errors", {
    unit: "1",
  });
  dbQueryDuration = meter.createHistogram("db.query.duration", { unit: "ms" });
  dbQueryCount = meter.createCounter("db.query.count", { unit: "1" });
  detectionRunDuration = meter.createHistogram(
    "soonwhy.detection.run.duration",
    { unit: "ms", description: "Wall-clock time of one detection run" },
  );
  detectionRuns = meter.createCounter("soonwhy.detection.runs", {
    unit: "1",
    description: "Detection runs by terminal status",
  });
  detectionFindings = meter.createCounter("soonwhy.detection.findings", {
    unit: "1",
    description: "Findings persisted, by severity",
  });
  aiInvocations = meter.createCounter("soonwhy.ai.rca.invocations", {
    unit: "1",
    description: "AI RCA invocations by provider, model and status",
  });
  aiTokens = meter.createCounter("soonwhy.ai.tokens", {
    unit: "1",
    description: "AI tokens consumed, by provider, model and direction",
  });
  aiEstimatedCostUsd = meter.createCounter("soonwhy.ai.estimated_cost_usd", {
    unit: "usd",
    description: "Estimated AI spend in USD, by provider and model",
  });
  aiRequestDuration = meter.createHistogram(
    "soonwhy.ai.rca.request.duration",
    { unit: "ms", description: "Wall-clock time of an AI RCA call" },
  );
}

export function getHttpRequestDuration() {
  ensureInstruments();
  return httpRequestDuration!;
}

export function getHttpRequestCount() {
  ensureInstruments();
  return httpRequestCount!;
}

export function getHttpRequestErrors() {
  ensureInstruments();
  return httpRequestErrors!;
}

export function getDbQueryDuration() {
  ensureInstruments();
  return dbQueryDuration!;
}

export function getDbQueryCount() {
  ensureInstruments();
  return dbQueryCount!;
}

export function recordDetectionRun(
  status: "success" | "failure",
  durationMs: number,
) {
  try {
    ensureInstruments();
    detectionRuns!.add(1, { status });
    detectionRunDuration!.record(
      Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0,
      { status },
    );
  } catch {
  }
}

export function recordDetectionFinding(severity: string) {
  try {
    ensureInstruments();
    detectionFindings!.add(1, { severity });
  } catch {
  }
}

export interface AiInvocationMetrics {
  provider: string;
  model: string;
  status: "succeeded" | "failed";
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}

export function recordAiInvocationMetrics(input: AiInvocationMetrics) {
  try {
    ensureInstruments();
    const attributes = { provider: input.provider, model: input.model };
    aiInvocations!.add(1, { ...attributes, status: input.status });
    if (input.durationMs !== undefined && Number.isFinite(input.durationMs)) {
      aiRequestDuration!.record(Math.max(0, input.durationMs), attributes);
    }
    if (input.inputTokens !== undefined && input.inputTokens >= 0) {
      aiTokens!.add(input.inputTokens, { ...attributes, direction: "input" });
    }
    if (input.outputTokens !== undefined && input.outputTokens >= 0) {
      aiTokens!.add(input.outputTokens, { ...attributes, direction: "output" });
    }
    if (
      input.estimatedCostUsd !== undefined &&
      Number.isFinite(input.estimatedCostUsd) &&
      input.estimatedCostUsd >= 0
    ) {
      aiEstimatedCostUsd!.add(input.estimatedCostUsd, attributes);
    }
  } catch {
  }
}
export function getPrometheusExporter() {
  return prometheusExporter;
}

export function initOtelMetrics(): MeterProvider | null {
  if (!selfObservabilityEnabled()) {
    new Logger("OtelMetrics").log(
      "Self-observability disabled (SELF_OBSERVABILITY_ENABLED != true); self-metrics export and /metrics off",
    );
    ensureInstruments();
    return null;
  }
  const url = resolveOtlpEndpoint("metrics");
  const prometheusEnabled =
    (process.env.PROMETHEUS_METRICS_ENABLED ?? "true") !== "false";

  if (!url && !prometheusEnabled) {
    ensureInstruments();
    return null;
  }

  const readers: MetricReader[] = [];
  let otlpReader: PeriodicExportingMetricReader | null = null;

  if (url) {
    const metricExporter = new OTLPMetricExporter({
      url,
      headers: resolveOtlpHeaders("metrics"),
    });

    otlpReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10_000,
    });
    readers.push(otlpReader);
  }

  if (prometheusEnabled) {
    prometheusExporter = new PrometheusExporter({ preventServerStart: true });
    readers.push(prometheusExporter);
  }

  const provider = new MeterProvider({
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
      [SemanticResourceAttributes.SERVICE_VERSION]:
        process.env.npm_package_version ?? "1.0.0",
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV ?? "development",
    }),
    readers,
  });

  metrics.setGlobalMeterProvider(provider);
  ensureInstruments();

  process.on("SIGTERM", async () => {
    await otlpReader?.shutdown();
    await prometheusExporter?.shutdown();
    process.exit(0);
  });

  return provider;
}
