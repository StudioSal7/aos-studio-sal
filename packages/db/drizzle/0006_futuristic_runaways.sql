CREATE TYPE "public"."roleplay_difficulty" AS ENUM('facil', 'medio', 'dificil');--> statement-breakpoint
CREATE TYPE "public"."roleplay_message_role" AS ENUM('prospect', 'closer', 'system');--> statement-breakpoint
CREATE TYPE "public"."roleplay_session_status" AS ENUM('em_andamento', 'concluida', 'abandonada');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roleplay_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"persona" text NOT NULL,
	"context" text NOT NULL,
	"objections" jsonb NOT NULL,
	"spin_focus" jsonb NOT NULL,
	"difficulty" "roleplay_difficulty" NOT NULL,
	"source_note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roleplay_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"lead_id" uuid,
	"trainee_label" text NOT NULL,
	"rubric_version" text NOT NULL,
	"status" "roleplay_session_status" DEFAULT 'em_andamento' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"overall_score" integer,
	"score_breakdown" jsonb,
	"feedback" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roleplay_sessions_overall_score_range" CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roleplay_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "roleplay_message_role" NOT NULL,
	"content" text NOT NULL,
	"turn_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roleplay_sessions" ADD CONSTRAINT "roleplay_sessions_scenario_id_roleplay_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."roleplay_scenarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roleplay_sessions" ADD CONSTRAINT "roleplay_sessions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roleplay_messages" ADD CONSTRAINT "roleplay_messages_session_id_roleplay_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."roleplay_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roleplay_scenarios_active_idx" ON "roleplay_scenarios" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roleplay_scenarios_name_unique" ON "roleplay_scenarios" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roleplay_sessions_scenario_idx" ON "roleplay_sessions" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roleplay_sessions_lead_idx" ON "roleplay_sessions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roleplay_sessions_trainee_idx" ON "roleplay_sessions" USING btree ("trainee_label");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roleplay_sessions_status_idx" ON "roleplay_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roleplay_messages_session_idx" ON "roleplay_messages" USING btree ("session_id");