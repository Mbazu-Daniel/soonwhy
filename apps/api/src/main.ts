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
import { Logger } from "@nestjs/common";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(helmet());
  app.use(compression());
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  app.setGlobalPrefix("api/v1");

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: process.env.FRONTEND_URL || ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  });

  const port = process.env.PORT || 8080;
  await app.listen(port);
  Logger.log(`Backend running on http://localhost:${port}`, "Bootstrap");
}
bootstrap();
