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
import { OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import type { IncomingMessage, ServerResponse } from "http";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import { AppModule } from "./app.module";
import { MetricsInterceptor } from "./common/telemetry/metrics.interceptor";
import { GlobalExceptionFilter } from "./common";
import { ensureQuickwitIndexes } from "./common/quickwit/ensure-indexes";
import { getPrometheusExporter } from "./common/telemetry/otel-metrics";
import { PiiMaskingLogger } from "./common/privacy/pii-masking.logger";
import { maskPii } from "./common/privacy/pii-masker";
import { apiDocument } from "./common/openapi/document";

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
  app.useGlobalInterceptors(new MetricsInterceptor());

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

  // Serve the hand-assembled OpenAPI document generated from the zod schemas
  // used at the validation edge (see common/openapi/document.ts). Auth is
  // documented today; more paths are registered incrementally.
  SwaggerModule.setup(
    "docs",
    app,
    apiDocument as unknown as OpenAPIObject,
    {
      jsonDocumentUrl: "docs-json",
      swaggerOptions: { persistAuthorization: true },
    },
  );

  // Pre-create the default telemetry indexes so read paths don't 500 on a
  // fresh instance (ingest creates them lazily, but reads happen before the
  // first ingest). Never blocks startup if Quickwit is unreachable.
  await ensureQuickwitIndexes();

  const port = process.env.PORT || 8080;
  await app.listen(port);
  Logger.log(`Backend running on http://localhost:${port}`, "Bootstrap");
}
bootstrap();
