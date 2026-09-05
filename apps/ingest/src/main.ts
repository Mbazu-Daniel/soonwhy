import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { IngestModule } from './ingest.module';

async function bootstrap() {
  const app = await NestFactory.create(IngestModule);
  const port = process.env.INGEST_PORT || 3002;
  await app.listen(port);
  Logger.log(`Ingest service listening on port ${port}`, 'Ingest');
}
bootstrap();
