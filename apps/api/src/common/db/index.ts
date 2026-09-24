import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  max: parsePositiveInt(process.env.DB_POOL_MAX, 20),
  idle_timeout: parsePositiveInt(process.env.DB_IDLE_TIMEOUT_SECONDS, 20),
  connect_timeout: parsePositiveInt(process.env.DB_CONNECT_TIMEOUT_SECONDS, 10),
  max_lifetime: parsePositiveInt(process.env.DB_MAX_LIFETIME_SECONDS, 60 * 30),
});
export const db = drizzle(client, { schema });
export { schema };

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
