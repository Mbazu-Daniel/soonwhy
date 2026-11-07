import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  SemanticResourceAttributes,
} from "@opentelemetry/semantic-conventions";
import { metrics, type Meter } from "@opentelemetry/api";

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? "soonwhy-api";
const OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:7280";
const OTLP_METRICS_PATH = "/api/v1/ingest/otlp/v1/metrics";

let meter: Meter | null = null;
let httpRequestDuration: ReturnType<Meter["createHistogram"]> | null = null;
let httpRequestCount: ReturnType<Meter["createCounter"]> | null = null;
let httpRequestErrors: ReturnType<Meter["createCounter"]> | null = null;
let dbQueryDuration: ReturnType<Meter["createHistogram"]> | null = null;
let dbQueryCount: ReturnType<Meter["createCounter"]> | null = null;

function ensureInstruments() {
  if (meter) return;
  meter = metrics.getMeter(SERVICE_NAME);
  httpRequestDuration = meter.createHistogram(
    "http.server.request.duration",
    { unit: "ms" },
  );
  httpRequestCount = meter.createCounter(
    "http.server.request.count",
    { unit: "1" },
  );
  httpRequestErrors = meter.createCounter(
    "http.server.request.errors",
    { unit: "1" },
  );
  dbQueryDuration = meter.createHistogram(
    "db.query.duration",
    { unit: "ms" },
  );
  dbQueryCount = meter.createCounter(
    "db.query.count",
    { unit: "1" },
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

export function initOtelMetrics() {
  const metricExporter = new OTLPMetricExporter({
    url: `${OTLP_ENDPOINT}${OTLP_METRICS_PATH}`,
  });

  const reader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 10_000,
  });

  const provider = new MeterProvider({
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
      [SemanticResourceAttributes.SERVICE_VERSION]:
        process.env.npm_package_version ?? "1.0.0",
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV ?? "development",
    }),
    readers: [reader],
  });

  metrics.setGlobalMeterProvider(provider);

  // Create instruments now that the provider is active
  ensureInstruments();

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    await reader.shutdown();
    process.exit(0);
  });

  return provider;
}
