import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { CronModule } from './cron.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(CronModule);
  Logger.log('Cron worker started', 'Cron');
  // Keep process alive for scheduled jobs; Nest schedule handles timers.
  process.on('SIGTERM', () => app.close());
  process.on('SIGINT', () => app.close());
}
bootstrap();
