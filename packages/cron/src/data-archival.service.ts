import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ClickhouseService } from '@soonwhy/shared';

const ARCHIVABLE_TABLES = ['logs', 'metrics', 'errors', 'requests', 'traces'] as const;

function isValidPartition(value: string): boolean {
  return /^\d{6}$/.test(value);
}

@Injectable()
export class DataArchivalService {
  private readonly logger = new Logger(DataArchivalService.name);
  private s3: S3Client | null = null;

  constructor(private readonly clickhouse: ClickhouseService) {
    const endpoint = process.env.R2_ENDPOINT;
    if (endpoint) {
      this.s3 = new S3Client({
        endpoint,
        region: 'auto',
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY || '',
          secretAccessKey: process.env.R2_SECRET_KEY || '',
        },
      });
    }
  }

  @Cron('0 2 * * *')
  async migratePartitions() {
    if (!this.s3) {
      this.logger.warn('R2 not configured, skipping');
      return;
    }

    for (const table of ARCHIVABLE_TABLES) {
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);

        const partitions = await this.clickhouse.query<{ org_id: string; partition: string }>(
          'SELECT org_id, partition FROM system.parts WHERE table = {t:String} AND active = 1 AND partition < {c:String} GROUP BY org_id, partition',
          { t: table, c: cutoff.toISOString().split('T')[0] },
        );

        for (const p of partitions) {
          if (!isValidPartition(p.partition)) {
            this.logger.warn(`Skipping invalid ClickHouse partition for ${table}`);
            continue;
          }

          const partition = Number(p.partition);
          const data = await this.clickhouse.query(
            'SELECT * FROM ' + table + ' WHERE toYYYYMM(timestamp) = {partition:UInt32}',
            { partition },
          );

          await this.s3.send(
            new PutObjectCommand({
              Bucket: process.env.R2_BUCKET || 'soonwhy-telemetry',
              Key: `${p.org_id}/${table}/${p.partition}.parquet`,
              Body: Buffer.from(JSON.stringify(data)),
            }),
          );

          await this.clickhouse.exec(
            'ALTER TABLE ' + table + ' DELETE WHERE toYYYYMM(timestamp) = ' + partition,
          );

          this.logger.log(`Migrated ${table} partition ${p.partition}`);
        }
      } catch (error) {
        this.logger.error(`Failed to migrate ${table}`, error);
      }
    }
  }
}
