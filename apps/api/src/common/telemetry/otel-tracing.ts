import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { resolveOtlpEndpoint, resolveOtlpHeaders } from "./otlp-config";
import { selfObservabilityEnabled } from "./self-observability";
import { Logger } from "@nestjs/common";

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? "soonwhy-api";
const logger = new Logger("OtelTracing");

export function initOtelTracing(): NodeSDK | null {
  if (!selfObservabilityEnabled()) {
    logger.log(
      "Self-observability disabled (SELF_OBSERVABILITY_ENABLED != true); self-export off",
    );
    return null;
  }
  const url = resolveOtlpEndpoint("traces");
  if (!url) return null;

  const traceExporter = new OTLPTraceExporter({
    url,
    headers: resolveOtlpHeaders("traces"),
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

  process.on("SIGTERM", async () => {
    await sdk.shutdown();
    process.exit(0);
  });

  return sdk;
}
