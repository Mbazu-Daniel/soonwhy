CREATE TABLE IF NOT EXISTS "uploads" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "organization_id" text,
  "target_id" text NOT NULL,
  "key" text NOT NULL,
  "file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer,
  "status" text NOT NULL DEFAULT 'PENDING',
  "upload_expires_at" timestamp,
  "created_by" text,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uploads_key_idx" ON "uploads" ("key");
CREATE INDEX IF NOT EXISTS "uploads_kind_target_idx" ON "uploads" ("kind", "target_id");
