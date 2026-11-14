CREATE TABLE IF NOT EXISTS "chat_threads" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL,
  "project_id" text NOT NULL,
  "created_by" text NOT NULL,
  "title" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chat_threads_org_id_organizations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade,
  CONSTRAINT "chat_threads_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade,
  CONSTRAINT "chat_threads_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "thread_id" text NOT NULL,
  "role" text NOT NULL,
  "content" text DEFAULT '' NOT NULL,
  "steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" text DEFAULT 'complete' NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk"
    FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_threads_owner_updated_idx"
  ON "chat_threads" USING btree ("org_id", "project_id", "created_by", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_thread_created_idx"
  ON "chat_messages" USING btree ("thread_id", "created_at");
