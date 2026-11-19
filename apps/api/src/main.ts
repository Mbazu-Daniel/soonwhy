import "reflect-metadata";

import "./dotenv";

import { initOtelTracing } from "./common/telemetry/otel-tracing";
initOtelTracing();

import { initOtelMetrics } from "./common/telemetry/otel-metrics";
initOtelMetrics();

import { NestFactory } from "@nestjs/core";
import { Logger, RequestMethod, StandardSchemaValidationPipe } from "@nestjs/common";
import { NestNodeApplication, NodeAdapter } from "@nestjs/platform-node";
import { OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import { AppModule } from "./app.module";
import { MetricsInterceptor } from "./common/telemetry/metrics.interceptor";
import { GlobalExceptionFilter } from "./common";
import { ensureQuickwitIndexes } from "./common/quickwit/ensure-indexes";
import { PiiMaskingLogger } from "./common/privacy/pii-masking.logger";
import { maskPii } from "./common/privacy/pii-masker";
import { apiDocument } from "./common/openapi/document";
import { beginDrain } from "./common/shutdown/shutdown-state";
import { DEFAULT_DRAIN_MS, SHUTDOWN_TIMEOUT_MS } from "./common/shutdown/shutdown.constants";
import { authCallbackHandler } from "./common/config/auth-callback";

function assertRateLimitNotDisabledInProduction() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.RATE_LIMIT_DISABLED === "1"
  ) {
    Logger.error(
      "RATE_LIMIT_DISABLED=1 is set in production: API rate limiting is OFF for every caller. Remove it or accept abuse exposure explicitly.",
      "Bootstrap",
    );
  }
}

async function bootstrap() {
  assertRateLimitNotDisabledInProduction();
  const app = await NestFactory.create<NestNodeApplication>(
    AppModule,
    new NodeAdapter(),
    { rawBody: true },
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

  app.use("/api/auth", authCallbackHandler);

  app.setGlobalPrefix("api/v1", { exclude: [{ path: "/", method: RequestMethod.GET }] });

  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new MetricsInterceptor());

  app.enableCors({
    origin: process.env.FRONTEND_URL || ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  });

  SwaggerModule.setup(
    "docs",
    app,
    apiDocument as unknown as OpenAPIObject,
    {
      jsonDocumentUrl: "docs-json",
      swaggerOptions: { persistAuthorization: true },
    },
  );

  await ensureQuickwitIndexes();

  const port = process.env.PORT || 8080;
  await app.listen(port);
  Logger.log(`Backend running on http://localhost:${port}`, "Bootstrap");

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    Logger.log(`${signal} received: draining before shutdown`, "Bootstrap");
    beginDrain();
    const forced = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
    forced.unref();
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.SHUTDOWN_DRAIN_MS ?? DEFAULT_DRAIN_MS)));
    await app.close();
    process.exit(0);
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  Logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}`, "Process");
});
process.on("uncaughtException", (error) => {
  Logger.error(`Uncaught exception: ${error.stack ?? error.message}`, "Process");
  process.exit(1);
});
bootstrap();
