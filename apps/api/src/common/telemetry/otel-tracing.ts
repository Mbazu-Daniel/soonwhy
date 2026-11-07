import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  SemanticResourceAttributes,
} from "@opentelemetry/semantic-conventions";

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? "soonwhy-api";
// Export OTLP directly to Quickwit (bypassing the collector which forwards
// to ingest:3002, unresolvable in this local environment).
const OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:7280";
const OTLP_TRACES_PATH = "/api/v1/ingest/otlp/v1/traces";

export function initOtelTracing() {
  const traceExporter = new OTLPTraceExporter({
    url: `${OTLP_ENDPOINT}${OTLP_TRACES_PATH}`,
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
      [SemanticResourceAttributes.SERVICE_VERSION]:
        process.env.npm_package_version ?? "1.0.0",
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV ?? "development",
    }),
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    await sdk.shutdown();
    process.exit(0);
  });

  return sdk;
}
