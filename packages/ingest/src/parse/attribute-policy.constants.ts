import type { AttributeLimits } from "./attribute-policy.types";

export const CONNECTION_POOL_NAME_KEY = "db.client.connection.pool.name";
export const CONNECTION_POOL_STATE_KEY = "db.client.connection.state";

export const METRIC_ATTRIBUTE_LIMITS = {
  maxAttributeCount: 50,
  maxAttributeValueLength: 256,
} satisfies AttributeLimits;

export const METRIC_FILTER_LABEL_KEYS: ReadonlySet<string> = new Set([
  "state",
  "direction",
  CONNECTION_POOL_NAME_KEY,
  CONNECTION_POOL_STATE_KEY,
]);
