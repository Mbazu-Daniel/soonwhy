import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { createClient, ClickHouseClient } from '@clickhouse/client';

@Injectable()
export class ClickhouseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClickhouseService.name);
  private client: ClickHouseClient | null = null;

  private readonly config = {
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    database: process.env.CLICKHOUSE_DB || 'soonwhy',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  };

  async onModuleInit() {
    try {
      this.client = createClient({
        url: this.config.url,
        database: this.config.database,
        username: this.config.username,
        password: this.config.password,
      });
      await this.client.ping();
      this.logger.log('ClickHouse connected');
    } catch (error) {
      this.logger.error('Failed to connect to ClickHouse', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
      this.logger.log('ClickHouse connection closed');
    }
  }

  getClient(): ClickHouseClient {
    if (!this.client) throw new Error('ClickHouse not connected');
    return this.client;
  }

  async insert(table: string, values: Record<string, unknown>[]) {
    return this.getClient().insert({ table, values, format: 'JSONEachRow' });
  }

  async query<T = any>(query: string, params?: Record<string, unknown>): Promise<T[]> {
    const result = await this.getClient().query({
      query,
      query_params: params || {},
      format: 'JSONEachRow',
    });
    return result.json<T[]>() as unknown as Promise<T[]>;
  }

  async exec(query: string) {
    return this.getClient().exec({ query });
  }

  async ping(): Promise<boolean> {
    try {
      await this.getClient().ping();
      return true;
    } catch {
      return false;
    }
  }
}
