CREATE TABLE IF NOT EXISTS "ai_provider_credentials" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "base_url" text,
  "encrypted_api_key" text NOT NULL,
  "key_hint" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE "ai_provider_credentials" ADD CONSTRAINT "ai_provider_credentials_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_credentials_org_unique" ON "ai_provider_credentials" USING btree ("org_id");
