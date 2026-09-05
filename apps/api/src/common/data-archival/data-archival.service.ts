import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ClickhouseService } from '../../clickhouse';

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

  async migratePartitions() {
    if (!this.s3) {
      this.logger.warn('R2 not configured, skipping');
      return;
    }
    for (const table of ['logs', 'metrics', 'errors', 'requests', 'traces']) {
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const partitions = await this.clickhouse.query<{ org_id: string; partition: string }>(
          `SELECT org_id, partition FROM system.parts WHERE table = {t:String} AND active = 1 AND partition < {c:String} GROUP BY org_id, partition`,
          { t: table, c: cutoff.toISOString().split('T')[0] },
        );
        for (const p of partitions) {
          const data = await this.clickhouse.query(`SELECT * FROM ${table} WHERE toYYYYMM(timestamp) = ${p.partition}`);
          await this.s3.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET || 'soonwhy-telemetry',
            Key: `${p.org_id}/${table}/${p.partition}.parquet`,
            Body: Buffer.from(JSON.stringify(data)),
          }));
          await this.clickhouse.exec(`ALTER TABLE ${table} DELETE WHERE toYYYYMM(timestamp) = ${p.partition}`);
          this.logger.log(`Migrated ${table} partition ${p.partition}`);
        }
      } catch (error) {
        this.logger.error(`Failed to migrate ${table}`, error);
      }
    }
  }
}
