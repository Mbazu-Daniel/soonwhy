CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "key_hash" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "fingerprint" text NOT NULL,
  "owner" text,
  "response" json,
  "expires_at" bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS "idempotency_keys_expires_at_idx" ON "idempotency_keys" ("expires_at");
