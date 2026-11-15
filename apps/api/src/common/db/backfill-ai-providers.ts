import type postgres from "postgres";

export async function backfillAiProviderLibrary(client: postgres.Sql): Promise<boolean> {
  const [state] = await client`
    select
      to_regclass('ai_provider_credentials') is not null as has_table,
      exists (
        select 1 from information_schema.columns
        where table_name = 'ai_provider_credentials' and column_name = 'name'
      ) as has_name
  `;
  if (!state?.has_table || state.has_name) return false;

  await client.begin(async (tx) => {
    await tx`alter table ai_provider_credentials add column "name" text`;
    await tx`alter table ai_provider_credentials add column is_default boolean not null default false`;
    await tx`update ai_provider_credentials set "name" = provider`;
    await tx`update ai_provider_credentials set is_default = true where deleted_at is null`;
  });
  return true;
}
