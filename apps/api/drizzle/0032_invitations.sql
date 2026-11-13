CREATE TABLE IF NOT EXISTS "invitations" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "team_id" text,
  "inviter_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_organization_id_idx" ON "invitations" ("organization_id");
