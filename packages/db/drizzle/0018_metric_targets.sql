CREATE TYPE "public"."metric_comparator" AS ENUM('gte', 'lte');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "metric_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_key" text NOT NULL,
	"comparator" "metric_comparator" NOT NULL,
	"threshold" numeric(10, 2) NOT NULL,
	"yellow_margin" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metric_targets_metric_key_unique" UNIQUE("metric_key"),
	CONSTRAINT "metric_targets_threshold_non_negative" CHECK (threshold >= 0),
	CONSTRAINT "metric_targets_yellow_margin_non_negative" CHECK (yellow_margin >= 0)
);
--> statement-breakpoint
ALTER TABLE "metric_targets" ENABLE ROW LEVEL SECURITY;