import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClickhouseService } from '@soonwhy/shared';
import { migrations } from './migrations';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);
  constructor(private readonly clickhouse: ClickhouseService) {}

  async onModuleInit() {
    await this.runMigrations();
  }

  async runMigrations() {
    this.logger.log('Running ClickHouse migrations...');
    await this.clickhouse.exec(`
      CREATE TABLE IF NOT EXISTS migration_history (
        name String, applied_at DateTime DEFAULT now()
      ) ENGINE = TinyLog()
    `);

    for (const migration of migrations) {
      const applied = await this.clickhouse.query<{ name: string }>(
        `SELECT name FROM migration_history WHERE name = {name:String}`,
        { name: migration.name },
      );
      if (applied.length > 0) continue;

      await this.clickhouse.exec(migration.query);
      await this.clickhouse.exec(
        `INSERT INTO migration_history (name) VALUES ('${migration.name.replace(/'/g, "''")}')`,
      );
      this.logger.log(`Migration "${migration.name}" applied`);
    }
    this.logger.log('ClickHouse migrations complete');
  }
}
