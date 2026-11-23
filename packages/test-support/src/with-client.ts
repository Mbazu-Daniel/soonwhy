import postgres from "postgres";
import { ADMIN_DATABASE_NAME } from "./constants";

export type SqlClient = ReturnType<typeof postgres>;

export async function withClient<Result>(connectionString: string, run: (client: SqlClient) => Promise<Result>): Promise<Result> {
  const client = postgres(connectionString, { max: 1, onnotice: () => undefined });
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export function databaseUrl(base: string, database: string): string {
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.toString();
}

export const adminUrl = (base: string): string => databaseUrl(base, ADMIN_DATABASE_NAME);
