import "../../dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { dbPoolOptions } from "@soonwhy/shared";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, dbPoolOptions());

export const rawDb = drizzle(client, { schema });
