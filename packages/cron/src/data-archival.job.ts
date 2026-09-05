import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataArchivalService } from './data-archival.service';

@Injectable()
export class DataArchivalJob {
  private readonly logger = new Logger(DataArchivalJob.name);
  constructor(private readonly archival: DataArchivalService) {}

  @Cron('0 2 * * *')
  async handleMigration() {
    this.logger.log('Starting daily data archival');
    await this.archival.migratePartitions();
  }
}
