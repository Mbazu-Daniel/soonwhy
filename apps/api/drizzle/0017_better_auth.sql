CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text UNIQUE NOT NULL,
  "name" text,
  "image" text,
  "email_verified" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "users"("id") ON DELETE CASCADE NOT NULL,
  "issuer" text NOT NULL DEFAULT 'local:credential',
  "provider_user_id" text NOT NULL DEFAULT '',
  "provider_id" text NOT NULL,
  "password_hash" text,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "accounts_issuer_provider_user_id_idx" ON "accounts" ("issuer", "provider_user_id");

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "users"("id") ON DELETE CASCADE NOT NULL,
  "token" text NOT NULL UNIQUE,
  "ip_address" text,
  "user_agent" text,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text UNIQUE NOT NULL,
  "logo" text,
  "metadata" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "members" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "users"("id") ON DELETE CASCADE NOT NULL,
  "organization_id" text REFERENCES "organizations"("id") ON DELETE CASCADE NOT NULL,
  "role" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
