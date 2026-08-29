import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClickhouseService } from '../clickhouse.service';
import { migrations } from './index';

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
        name String,
        applied_at DateTime DEFAULT now()
      ) ENGINE = TinyLog()
    `);

    for (const migration of migrations) {
      try {
        const applied = await this.clickhouse.query<{ name: string }>(
          `SELECT name FROM migration_history WHERE name = {name:String}`,
          { name: migration.name },
        );

        if (applied.length > 0) {
          this.logger.debug(`Migration "${migration.name}" already applied, skipping`);
          continue;
        }

        await this.clickhouse.exec(migration.query);
        await this.clickhouse.insert('migration_history', [{ name: migration.name }]);
        this.logger.log(`Migration "${migration.name}" applied`);
      } catch (error) {
        this.logger.error(`Migration "${migration.name}" failed`, error);
        throw error;
      }
    }

    this.logger.log('ClickHouse migrations complete');
  }
}
