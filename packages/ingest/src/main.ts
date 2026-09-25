import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { IngestModule } from './module';

async function bootstrap() {
  const app = await NestFactory.create(IngestModule, { bodyParser: false });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  const port = process.env.PORT || 3002;
  await app.listen(port);
  Logger.log(`OTLP ingestion running on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
