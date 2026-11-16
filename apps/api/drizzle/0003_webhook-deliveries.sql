CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"delivery_id" text NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_source_delivery_idx" ON "webhook_deliveries" USING btree ("source","delivery_id");