const DEFAULT_POOL_MAX = 10;

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function dbPoolOptions(env: Record<string, string | undefined> = process.env) {
  return {
    max: positiveInt(env.DB_POOL_MAX, DEFAULT_POOL_MAX),
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  };
}
