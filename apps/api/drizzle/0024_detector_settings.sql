CREATE TABLE IF NOT EXISTS "detector_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"detectors" jsonb DEFAULT '{}' NOT NULL,
	"feature_flags" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
