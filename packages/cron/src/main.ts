import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { CronModule } from './cron.module';

async function bootstrap() {
  const app = await NestFactory.create(CronModule);
  const port = process.env.CRON_PORT || 3003;
  await app.listen(port);
  Logger.log(`Cron service listening on port ${port}`, 'Cron');
}
bootstrap();
