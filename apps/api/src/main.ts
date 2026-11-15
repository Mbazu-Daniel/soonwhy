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
import { authCallbackHandler } from "./common/config/auth-callback";

async function bootstrap() {
  const app = await NestFactory.create<NestNodeApplication>(
    AppModule,
    new NodeAdapter(),
  );

  app.useLogger(new PiiMaskingLogger());
  app.enableShutdownHooks();

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
}
bootstrap();
