import { initNode } from "@soonwhy/sdk/node";

const apiKey = process.env.SOONWHY_API_KEY;
if (!apiKey) throw new Error("SOONWHY_API_KEY is required");

const sdk = initNode({
  apiKey,
  endpoint: process.env.SOONWHY_ENDPOINT,
  serviceName: "soonwhy-example-dependencies",
  environment: "4c-validation",
});

const { Pool } = await import("pg");
const { default: Redis } = await import("ioredis");

const postgres = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 1_000,
});

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

try {
  await postgres.query("select 1");
  await redis.set("soonwhy:4c", "ok");
  await redis.get("soonwhy:4c");
  console.log("PostgreSQL and Redis validation operations completed");
} finally {
  await redis.quit();
  await postgres.end();
  await sdk.shutdown();
}
