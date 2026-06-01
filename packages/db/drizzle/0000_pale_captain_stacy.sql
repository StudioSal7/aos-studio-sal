CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."abordagem_preferida" AS ENUM('orientacao_sensivel', 'equipe_constroi');--> statement-breakpoint
CREATE TYPE "public"."action_completion_kind" AS ENUM('done', 'replaced');--> statement-breakpoint
CREATE TYPE "public"."idade_faixa" AS ENUM('19_a_24', '25_a_34', '35_a_44', '45_a_54', '55_a_64');--> statement-breakpoint
CREATE TYPE "public"."intake_source" AS ENUM('respondi_webhook', 'legacy_csv_import', 'manual');--> statement-breakpoint
CREATE TYPE "public"."intake_status" AS ENUM('ok', 'duplicate_upsert', 'failed');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('agendada', 'realizada', 'nao_realizada', 'reagendada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."next_action_type" AS ENUM('call', 'follow_up', 'mandar_contrato', 'cobrar_sinal', 'outro');--> statement-breakpoint
CREATE TYPE "public"."stage_kind" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."tempo_no_nicho_faixa" AS ENUM('menos_5', '5_a_10', '11_a_15', 'mais_16');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'sdr', 'closer');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "user_role" NOT NULL,
	"pending_invite" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"position" integer NOT NULL,
	"kind" "stage_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_stages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_loss_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_loss_reasons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_objections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_objections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"kind" text,
	"ticket_min" integer,
	"ticket_max" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"nickname" text,
	"whatsapp_e164" text,
	"whatsapp_digits_only" text GENERATED ALWAYS AS (regexp_replace(whatsapp_e164, 'D', '', 'g')) STORED,
	"email" text,
	"instagram_handle" text,
	"cidade" text,
	"estado" text,
	"lead_source_id" uuid,
	"lead_source_other" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"intake_respondent_id" text,
	"idade_faixa" "idade_faixa",
	"abordagem_preferida" "abordagem_preferida",
	"tempo_no_nicho_faixa" "tempo_no_nicho_faixa",
	"renda_faixa" text,
	"orcamento_faixa" text,
	"profissao" text,
	"tempo_negocio" text,
	"eh_cliente_anterior" boolean DEFAULT false NOT NULL,
	"produto_interesse_id" uuid,
	"stage_id" uuid NOT NULL,
	"next_action_at" timestamp with time zone,
	"next_action_type" "next_action_type",
	"next_action_notes" text,
	"sdr_id" uuid,
	"closer_id" uuid,
	"valor_proposto" numeric(12, 2),
	"forma_pagamento_negociada" text,
	"motivo_perda_id" uuid,
	"needs_manual_review" boolean DEFAULT false NOT NULL,
	"manual_review_reason" text,
	"requires_attention" boolean DEFAULT false NOT NULL,
	"requires_attention_reason" text,
	"marcado_fake" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "leads_intake_respondent_id_unique" UNIQUE("intake_respondent_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"link" text,
	"status" "meeting_status" DEFAULT 'agendada' NOT NULL,
	"needs_confirmation" boolean DEFAULT false NOT NULL,
	"notes_post_call" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"from_stage_id" uuid,
	"to_stage_id" uuid NOT NULL,
	"duration_in_previous_seconds" bigint,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_field_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_action_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"action_at" timestamp with time zone NOT NULL,
	"action_type" "next_action_type" NOT NULL,
	"notes" text,
	"set_by" uuid,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"completion_kind" "action_completion_kind"
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_intake_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "intake_source" NOT NULL,
	"external_id" text,
	"payload_raw" jsonb,
	"payload_parsed" jsonb,
	"lead_id" uuid,
	"status" "intake_status" NOT NULL,
	"error_message" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_lead_source_id_lead_sources_id_fk" FOREIGN KEY ("lead_source_id") REFERENCES "public"."lead_sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_produto_interesse_id_products_id_fk" FOREIGN KEY ("produto_interesse_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_id_lead_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."lead_stages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_sdr_id_users_id_fk" FOREIGN KEY ("sdr_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_closer_id_users_id_fk" FOREIGN KEY ("closer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_motivo_perda_id_lead_loss_reasons_id_fk" FOREIGN KEY ("motivo_perda_id") REFERENCES "public"."lead_loss_reasons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meetings" ADD CONSTRAINT "meetings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_from_stage_id_lead_stages_id_fk" FOREIGN KEY ("from_stage_id") REFERENCES "public"."lead_stages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_to_stage_id_lead_stages_id_fk" FOREIGN KEY ("to_stage_id") REFERENCES "public"."lead_stages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_field_audit" ADD CONSTRAINT "lead_field_audit_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_field_audit" ADD CONSTRAINT "lead_field_audit_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_action_log" ADD CONSTRAINT "lead_action_log_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_action_log" ADD CONSTRAINT "lead_action_log_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_action_log" ADD CONSTRAINT "lead_action_log_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_intake_log" ADD CONSTRAINT "lead_intake_log_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_stage_idx" ON "leads" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_sdr_idx" ON "leads" USING btree ("sdr_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_closer_idx" ON "leads" USING btree ("closer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_next_action_at_idx" ON "leads" USING btree ("next_action_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_needs_review_idx" ON "leads" USING btree ("needs_manual_review") WHERE needs_manual_review = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_requires_attention_idx" ON "leads" USING btree ("requires_attention") WHERE requires_attention = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_deleted_at_idx" ON "leads" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_whatsapp_digits_idx" ON "leads" USING btree ("whatsapp_digits_only");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_name_trgm" ON "leads" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_nickname_trgm" ON "leads" USING gin ("nickname" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_email_trgm" ON "leads" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_instagram_trgm" ON "leads" USING gin ("instagram_handle" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_lead_idx" ON "meetings" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_scheduled_idx" ON "meetings" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_status_idx" ON "meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_needs_confirmation_idx" ON "meetings" USING btree ("needs_confirmation");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_stage_history_lead_idx" ON "lead_stage_history" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_stage_history_to_stage_idx" ON "lead_stage_history" USING btree ("to_stage_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_stage_history_changed_at_idx" ON "lead_stage_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_field_audit_lead_idx" ON "lead_field_audit" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_field_audit_field_idx" ON "lead_field_audit" USING btree ("field_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_field_audit_changed_at_idx" ON "lead_field_audit" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_action_log_lead_idx" ON "lead_action_log" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_action_log_action_at_idx" ON "lead_action_log" USING btree ("action_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_intake_log_source_idx" ON "lead_intake_log" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_intake_log_external_id_idx" ON "lead_intake_log" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_intake_log_lead_idx" ON "lead_intake_log" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_intake_log_received_at_idx" ON "lead_intake_log" USING btree ("received_at");