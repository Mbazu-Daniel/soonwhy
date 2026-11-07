import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Inject } from "@nestjs/common";
import * as schema from "./schema";

export const DB = Symbol("DB");

export type Db = ReturnType<typeof drizzle>;

export function createDb(databaseUrl = process.env.DATABASE_URL!): Db {
  const client = postgres(databaseUrl, {
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  });
  return drizzle(client, { schema });
}

export { schema };
export { Inject };
