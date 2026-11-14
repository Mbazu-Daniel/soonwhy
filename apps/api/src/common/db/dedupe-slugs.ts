import type postgres from "postgres";

const SLUG_SCOPES = [
  { table: "teams", scope: "org_id" },
  { table: "environments", scope: "project_id" },
  { table: "services", scope: "project_id" },
  { table: "business_operations", scope: "project_id" },
] as const;

export async function dedupeSlugs(client: postgres.Sql): Promise<number> {
  let renamed = 0;
  for (const { table, scope } of SLUG_SCOPES) {
    const [found] = await client`select to_regclass(${table}) is not null as exists`;
    if (!found?.exists) continue;
    const rows = await client.unsafe(
      `update ${table} as target
         set slug = target.slug || '-dup-' || ranked.position
         from (
           select id, row_number() over (partition by ${scope}, slug order by created_at nulls first, id) as position
           from ${table}
         ) as ranked
         where target.id = ranked.id and ranked.position > 1
         returning target.id`,
    );
    renamed += rows.length;
  }
  return renamed;
}
