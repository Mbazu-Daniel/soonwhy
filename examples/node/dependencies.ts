import { initNode } from '@soonwhy/sdk/node';

const sdk = initNode({
  apiKey: process.env.SOONWHY_API_KEY ?? '',
  endpoint: process.env.SOONWHY_ENDPOINT,
  serviceName: 'soonwhy-example-dependencies',
  environment: '4c-validation',
});

const { Pool } = await import('pg');
const { default: Redis } = await import('ioredis');

const postgres = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres',
  connectionTimeoutMillis: 1_000,
});

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

try {
  await postgres.query('select 1');
  await redis.set('soonwhy:4c', 'ok');
  await redis.get('soonwhy:4c');
  console.log('PostgreSQL and Redis validation operations completed');
} finally {
  await redis.quit();
  await postgres.end();
  await sdk.shutdown();
}
