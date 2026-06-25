CREATE TYPE "public"."form_field_type" AS ENUM('boas_vindas', 'texto_curto', 'texto_longo', 'email', 'telefone', 'url', 'numero', 'data', 'select', 'multi_select', 'escala', 'sim_nao', 'encerramento');--> statement-breakpoint
CREATE TYPE "public"."form_status" AS ENUM('rascunho', 'ativo', 'pausado', 'encerrado');--> statement-breakpoint
ALTER TYPE "public"."intake_source" ADD VALUE 'formulario_web';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"slug" text NOT NULL,
	"status" "form_status" DEFAULT 'rascunho' NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"tipo" "form_field_type" NOT NULL,
	"titulo" text NOT NULL,
	"subtitulo" text,
	"placeholder" text,
	"obrigatorio" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"lead_mapping" text,
	"lead_enum_map" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"lead_id" uuid,
	"dados" jsonb NOT NULL,
	"metadata" jsonb,
	"iniciado_em" timestamp with time zone,
	"concluido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"tempo_preenchimento_seg" integer,
	"parcial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forms_status_idx" ON "forms" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_fields_form_idx" ON "form_fields" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_responses_form_idx" ON "form_responses" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_responses_lead_idx" ON "form_responses" USING btree ("lead_id");