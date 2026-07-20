CREATE TABLE IF NOT EXISTS "meta_insights_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"ad_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_name" text NOT NULL,
	"adset_id" text NOT NULL,
	"adset_name" text NOT NULL,
	"ad_name" text NOT NULL,
	"spend_cents" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"reach_daily" integer DEFAULT 0 NOT NULL,
	"link_clicks" integer DEFAULT 0 NOT NULL,
	"landing_page_views" integer DEFAULT 0 NOT NULL,
	"video_3s" integer DEFAULT 0 NOT NULL,
	"video_p25" integer DEFAULT 0 NOT NULL,
	"video_p50" integer DEFAULT 0 NOT NULL,
	"video_p75" integer DEFAULT 0 NOT NULL,
	"video_p95" integer DEFAULT 0 NOT NULL,
	"purchases" integer DEFAULT 0 NOT NULL,
	"purchase_value_cents" integer DEFAULT 0 NOT NULL,
	"actions_raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meta_insights_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meta_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"since_date" date NOT NULL,
	"until_date" date NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"rows_upserted" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meta_sync_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meta_account_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_date" date NOT NULL,
	"level" text NOT NULL,
	"entity_id" text,
	"event_type" text NOT NULL,
	"note" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meta_account_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meta_insights_daily_date_ad_unique" ON "meta_insights_daily" USING btree ("date","ad_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meta_insights_daily_ad_id_idx" ON "meta_insights_daily" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meta_insights_daily_date_idx" ON "meta_insights_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meta_account_events_event_date_idx" ON "meta_account_events" USING btree ("event_date");