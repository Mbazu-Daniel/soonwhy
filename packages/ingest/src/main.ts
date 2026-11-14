import "./dotenv";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { IngestModule } from "./module";

function checkProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const logger = new Logger("Config");
  if (
    !/^[0-9a-fA-F]{64}$/.test(process.env.SOONWHY_PII_ENCRYPTION_KEY?.trim() ?? "")
  ) {
    logger.error(
      "SOONWHY_PII_ENCRYPTION_KEY is missing or not a 64-character hex string. Log ingestion will fail and records will dead-letter.",
    );
  }
  logger.log(
    `QUICKWIT_URL=${process.env.QUICKWIT_URL ?? "(unset)"} NATS_URL=${process.env.NATS_URL ? "set" : "(unset)"} DATABASE_URL=${process.env.DATABASE_URL ? "set" : "(unset)"}`,
  );
}

async function bootstrap() {
  checkProductionConfig();
  const app = await NestFactory.create(IngestModule, { bodyParser: false });
  app.enableShutdownHooks();
  const port = Number(process.env.INGEST_PORT ?? 3002);
  await app.listen(port);
  Logger.log(`OTLP ingestion running on http://localhost:${port}`, "Bootstrap");
}
bootstrap();
