import { Module, Global } from '@nestjs/common';
import { ClickhouseService } from './clickhouse.service';
import { MigrationService } from './migrations/migration.service';

@Global()
@Module({
  providers: [ClickhouseService, MigrationService],
  exports: [ClickhouseService],
})
export class ClickhouseModule {}
