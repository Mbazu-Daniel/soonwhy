import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ClickhouseService } from '../../../clickhouse';

export interface ColdStorageConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

interface PartitionInfo {
  org_id: string;
  table: string;
  partition: string;
  min_date: string;
  max_date: string;
}

@Injectable()
export class ColdStorageService {
  private readonly logger = new Logger(ColdStorageService.name);
  private s3: S3Client | null = null;

  private readonly config: ColdStorageConfig = {
    endpoint: process.env.R2_ENDPOINT || '',
    accessKeyId: process.env.R2_ACCESS_KEY || '',
    secretAccessKey: process.env.R2_SECRET_KEY || '',
    bucket: process.env.R2_BUCKET || 'soonwhy-telemetry',
  };

  constructor(private readonly clickhouse: ClickhouseService) {
    if (this.config.endpoint) {
      this.s3 = new S3Client({
        endpoint: this.config.endpoint,
        region: 'auto',
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      });
    }
  }

  @Cron('0 2 * * *')
  async migratePartitions() {
    if (!this.s3) {
      this.logger.warn('R2 not configured, skipping cold storage migration');
      return;
    }

    const tables = ['logs', 'metrics', 'errors', 'requests', 'traces'];

    for (const table of tables) {
      try {
        await this.migrateTable(table);
      } catch (error) {
        this.logger.error(`Failed to migrate ${table}`, error);
      }
    }
  }

  private async migrateTable(table: string) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const partitions = await this.clickhouse.query<PartitionInfo>(
      `SELECT
        org_id,
        table,
        partition,
        min(time) as min_date,
        max(time) as max_date
      FROM system.parts
      WHERE table = {table:String}
        AND active = 1
        AND partition < {cutoff:String}
      GROUP BY org_id, table, partition
      ORDER BY partition`,
      { table, cutoff: cutoffDate.toISOString().split('T')[0] },
    );

    for (const partition of partitions) {
      try {
        await this.exportPartition(partition);
        await this.deletePartition(partition);
        this.logger.log(`Migrated partition ${partition.partition} from ${table}`);
      } catch (error) {
        this.logger.error(`Failed to migrate partition ${partition.partition}`, error);
      }
    }
  }

  private async exportPartition(partition: PartitionInfo) {
    const query = `SELECT * FROM ${partition.table} WHERE toYYYYMM(timestamp) = ${partition.partition}`;

    const result = await this.clickhouse.query(query);
    const parquet = this.convertToParquet(result);

    const key = `${partition.org_id}/${partition.table}/${partition.partition}.parquet`;

    await this.s3!.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: parquet,
        ContentType: 'application/octet-stream',
      }),
    );
  }

  private async deletePartition(partition: PartitionInfo) {
    await this.clickhouse.exec(
      `ALTER TABLE ${partition.table} DELETE WHERE toYYYYMM(timestamp) = ${partition.partition}`,
    );
  }

  private convertToParquet(data: any[]): Buffer {
    // Placeholder: implement proper Parquet conversion
    // For MVP, store as JSON (will be replaced with proper Parquet later)
    return Buffer.from(JSON.stringify(data));
  }
}
