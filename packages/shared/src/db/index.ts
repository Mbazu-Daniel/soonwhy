import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { dbPoolOptions } from "./pool-options";
import * as schema from "./schema";

export const DB = Symbol("DB");

export type Db = ReturnType<typeof drizzle>;

export function createDb(databaseUrl = process.env.DATABASE_URL!): Db {
  const client = postgres(databaseUrl, dbPoolOptions());
  return drizzle(client, { schema });
}

export { schema };
export { dbPoolOptions } from "./pool-options";
