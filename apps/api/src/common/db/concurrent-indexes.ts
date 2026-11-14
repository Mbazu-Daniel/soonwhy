import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import type postgres from "postgres";
import * as schema from "./schema";

const DEFAULT_MIN_ROWS = 100_000;

type IndexColumn = { name?: string; indexConfig?: { order?: string } };

export type IndexPlan = { table: string; name: string; unique: boolean; columns: string[] };

export function plannedIndexes(tables: PgTable[] = (Object.values(schema) as unknown[]).filter((value) => is(value, PgTable)) as PgTable[]): IndexPlan[] {
  const plans: IndexPlan[] = [];
  for (const table of tables) {
    const config = getTableConfig(table);
    for (const index of config.indexes) {
      const columns = index.config.columns as IndexColumn[];
      if (index.config.where || columns.some((column) => !column.name)) continue;
      plans.push({
        table: config.name,
        name: index.config.name ?? "",
        unique: Boolean(index.config.unique),
        columns: columns.map((column) => `"${column.name}"${column.indexConfig?.order === "desc" ? " DESC" : ""}`),
      });
    }
  }
  return plans.filter((plan) => plan.name);
}

export function createIndexSql(plan: IndexPlan): string {
  return `CREATE ${plan.unique ? "UNIQUE " : ""}INDEX CONCURRENTLY IF NOT EXISTS "${plan.name}" ON "${plan.table}" (${plan.columns.join(", ")})`;
}

export async function buildLargeIndexesConcurrently(
  client: postgres.Sql,
  minRows: number = Number(process.env.CONCURRENT_INDEX_MIN_ROWS ?? DEFAULT_MIN_ROWS),
  plans: IndexPlan[] = plannedIndexes(),
): Promise<string[]> {
  const built: string[] = [];
  for (const plan of plans) {
    const [state] = await client`
      select
        to_regclass(${plan.table}) is not null as "tableExists",
        coalesce((select reltuples::bigint from pg_class where oid = to_regclass(${plan.table})), 0) as rows,
        (select i.indisvalid from pg_class c join pg_index i on i.indexrelid = c.oid where c.relname = ${plan.name}) as valid
    `;
    if (!state?.tableExists || state.valid === true || Number(state.rows) < minRows) continue;
    if (state.valid === false) await client.unsafe(`DROP INDEX CONCURRENTLY IF EXISTS "${plan.name}"`);
    await client.unsafe(createIndexSql(plan));
    built.push(plan.name);
  }
  return built;
}
