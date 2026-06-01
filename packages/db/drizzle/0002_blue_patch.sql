CREATE TYPE "public"."analysis_status" AS ENUM('pendente', 'processando', 'concluido', 'erro');--> statement-breakpoint
CREATE TYPE "public"."analyzer" AS ENUM('closer', 'sdr');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commercial_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analyzer" "analyzer" NOT NULL,
	"lead_id" uuid,
	"title" text NOT NULL,
	"call_date" date NOT NULL,
	"source_type" text,
	"source_file" text,
	"transcript" text NOT NULL,
	"duration_minutes" integer,
	"overall_score" integer,
	"score_breakdown" jsonb,
	"score_summary" text,
	"extracted_data" jsonb,
	"status" "analysis_status" DEFAULT 'pendente' NOT NULL,
	"error_message" text,
	"analyzed_by" text DEFAULT 'gpt-4o' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commercial_analyses_overall_score_range" CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commercial_analyses" ADD CONSTRAINT "commercial_analyses_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commercial_analyses" ADD CONSTRAINT "commercial_analyses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commercial_analyses_analyzer_idx" ON "commercial_analyses" USING btree ("analyzer");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commercial_analyses_lead_idx" ON "commercial_analyses" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commercial_analyses_status_idx" ON "commercial_analyses" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commercial_analyses_call_date_idx" ON "commercial_analyses" USING btree ("call_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "commercial_analyses_source_file_unique" ON "commercial_analyses" USING btree ("source_file") WHERE source_file IS NOT NULL;