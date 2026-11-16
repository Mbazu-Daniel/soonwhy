const DEFAULT_POOL_MAX = 10;
const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;
const DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS = 30_000;

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
    connection: {
      statement_timeout: positiveInt(
        env.DB_STATEMENT_TIMEOUT_MS,
        DEFAULT_STATEMENT_TIMEOUT_MS,
      ),
      idle_in_transaction_session_timeout: positiveInt(
        env.DB_IDLE_IN_TRANSACTION_TIMEOUT_MS,
        DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS,
      ),
    },
  };
}
