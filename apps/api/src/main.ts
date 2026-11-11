import "reflect-metadata";

// Load .env from the repo root before any other module so env-dependent
// module-level code (e.g. better-auth secret) reads it at import time.
import "./dotenv";

// Initialize OpenTelemetry tracing BEFORE NestJS bootstraps so all
// HTTP requests are instrumented from the start.
import { initOtelTracing } from "./common/telemetry/otel-tracing";
initOtelTracing();

// Initialize OpenTelemetry metrics (separate SDK from tracing).
import { initOtelMetrics } from "./common/telemetry/otel-metrics";
initOtelMetrics();

import { NestFactory } from "@nestjs/core";
import { Logger, StandardSchemaValidationPipe } from "@nestjs/common";
import { NestNodeApplication, NodeAdapter } from "@nestjs/platform-node";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { IncomingMessage, ServerResponse } from "http";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common";
import { ensureQuickwitIndexes } from "./common/quickwit/ensure-indexes";
import { getPrometheusExporter } from "./common/telemetry/otel-metrics";
import { PiiMaskingLogger } from "./common/privacy/pii-masking.logger";
import { maskPii } from "./common/privacy/pii-masker";

async function bootstrap() {
  const app = await NestFactory.create<NestNodeApplication>(
    AppModule,
    new NodeAdapter(),
  );

  app.useLogger(new PiiMaskingLogger());

  app.use(helmet());
  app.use(compression());
  app.use(
    morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
      stream: {
        write: (message: string) =>
          Logger.log(maskPii(message.trim()), "HTTP"),
      },
    }),
  );

  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: process.env.FRONTEND_URL || ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  });

  // Prometheus scrape endpoint. Unprefixed so Prometheus can reach it
  // without the /api/v1 prefix; set PROMETHEUS_METRICS_TOKEN to require a
  // bearer token. Disabled with PROMETHEUS_METRICS_ENABLED=false.
  const prometheus = getPrometheusExporter();
  if (prometheus) {
    const scrapeToken = process.env.PROMETHEUS_METRICS_TOKEN;
    app.use("/metrics", (req: IncomingMessage, res: ServerResponse) => {
      if (scrapeToken) {
        const auth = req.headers.authorization;
        if (auth !== `Bearer ${scrapeToken}`) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            code: "unauthorized",
            title: "Unauthorized",
            detail: "Set PROMETHEUS_METRICS_TOKEN and send it as a bearer token to scrape /metrics.",
          }));
          return;
        }
      }
      prometheus.getMetricsRequestHandler(req, res);
    });
  }

  // OpenAPI (Swagger UI at /docs, machine-readable spec at /docs-json).
  // Paths are auto-discovered from controllers; bodies are largely untyped
  // (validation is zod at the edge), so treat the spec as a route catalogue
  // and annotate incrementally.
  // Temporarily disabled due to unknown body types in controllers
  /*
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Soonwhy API")
    .setDescription(
      "OpenTelemetry-native observability: ingestion, query, detections, AI root-cause analysis and alerting. All routes are prefixed with /api/v1; organization-scoped routes live under /api/v1/organization/:organizationId. " +
      "Intelligence modules: evidence graph, AI investigation, recommendations, verification, performance/query/error/trace/log intelligence.",
    )
    .setVersion(process.env.npm_package_version ?? "1.0.0")
    .addBearerAuth()
    .addServer(process.env.SWAGGER_SERVER_URL ?? "http://localhost:3001")
    .addTag("Intelligence", "AI-powered SRE intelligence layer")
    .addTag("Evidence Graph", "Correlation graph for telemetry evidence")
    .addTag("AI Investigation", "Root cause analysis with AI")
    .addTag("Recommendations", "Actionable recommendations from findings")
    .addTag("Verification", "Before/after change verification")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document, {
    jsonDocumentUrl: "docs-json",
    swaggerOptions: { persistAuthorization: true },
  });
  */

  // Pre-create the default telemetry indexes so read paths don't 500 on a
  // fresh instance (ingest creates them lazily, but reads happen before the
  // first ingest). Never blocks startup if Quickwit is unreachable.
  await ensureQuickwitIndexes();

  const port = process.env.PORT || 8080;
  await app.listen(port);
  Logger.log(`Backend running on http://localhost:${port}`, "Bootstrap");
}
bootstrap();
