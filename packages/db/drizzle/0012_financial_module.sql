CREATE TYPE "public"."bank_statement_format" AS ENUM('ofx', 'csv');--> statement-breakpoint
CREATE TYPE "public"."bank_statement_line_status" AS ENUM('nao_conciliado', 'conciliado', 'ignorado');--> statement-breakpoint
CREATE TYPE "public"."dre_section" AS ENUM('receita_bruta', 'deducao', 'imposto', 'custo', 'despesa_fixa', 'despesa_variavel', 'outra');--> statement-breakpoint
CREATE TYPE "public"."financial_account_kind" AS ENUM('banco', 'caixa', 'carteira_digital');--> statement-breakpoint
CREATE TYPE "public"."financial_entry_kind" AS ENUM('receita', 'despesa');--> statement-breakpoint
CREATE TYPE "public"."financial_entry_status" AS ENUM('em_aberto', 'liquidado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."financial_origin_source" AS ENUM('manual', 'hotmart_sale', 'lead_paid', 'recurring', 'bank_reconciliation');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "financial_account_kind" DEFAULT 'banco' NOT NULL,
	"opening_balance_cents" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"entry_kind" "financial_entry_kind" NOT NULL,
	"dre_section" "dre_section" NOT NULL,
	"parent_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_recurring_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "financial_entry_kind" NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"category_id" uuid NOT NULL,
	"account_id" uuid,
	"day_of_month" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "financial_entry_kind" NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"competence_date" date NOT NULL,
	"due_date" date,
	"cash_date" timestamp with time zone,
	"status" "financial_entry_status" DEFAULT 'em_aberto' NOT NULL,
	"category_id" uuid NOT NULL,
	"account_id" uuid,
	"origin_source" "financial_origin_source" DEFAULT 'manual' NOT NULL,
	"origin_hotmart_sale_id" uuid,
	"origin_lead_id" uuid,
	"recurring_template_id" uuid,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bank_statement_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"format" "bank_statement_format" NOT NULL,
	"period_start" date,
	"period_end" date,
	"line_count" integer DEFAULT 0 NOT NULL,
	"imported_by" uuid,
	"raw_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bank_statement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"amount_cents" integer NOT NULL,
	"description" text NOT NULL,
	"fitid" text,
	"dedup_hash" text NOT NULL,
	"reconciled_entry_id" uuid,
	"status" "bank_statement_line_status" DEFAULT 'nao_conciliado' NOT NULL,
	"raw_row" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_recurring_templates" ADD CONSTRAINT "financial_recurring_templates_category_id_financial_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."financial_categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_recurring_templates" ADD CONSTRAINT "financial_recurring_templates_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_category_id_financial_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."financial_categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_origin_hotmart_sale_id_sal_sales_id_fk" FOREIGN KEY ("origin_hotmart_sale_id") REFERENCES "public"."sal_sales"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_origin_lead_id_leads_id_fk" FOREIGN KEY ("origin_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_recurring_template_id_financial_recurring_templates_id_fk" FOREIGN KEY ("recurring_template_id") REFERENCES "public"."financial_recurring_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_import_id_bank_statement_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."bank_statement_imports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_reconciled_entry_id_financial_entries_id_fk" FOREIGN KEY ("reconciled_entry_id") REFERENCES "public"."financial_entries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_accounts_active_idx" ON "financial_accounts" USING btree ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_categories_entry_kind_idx" ON "financial_categories" USING btree ("entry_kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_categories_dre_section_idx" ON "financial_categories" USING btree ("dre_section");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_categories_parent_idx" ON "financial_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_recurring_active_idx" ON "financial_recurring_templates" USING btree ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_recurring_category_idx" ON "financial_recurring_templates" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_entries_competence_idx" ON "financial_entries" USING btree ("competence_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_entries_cash_idx" ON "financial_entries" USING btree ("cash_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_entries_due_idx" ON "financial_entries" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_entries_status_idx" ON "financial_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_entries_category_idx" ON "financial_entries" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_entries_account_idx" ON "financial_entries" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "financial_entries_hotmart_unique" ON "financial_entries" USING btree ("origin_hotmart_sale_id") WHERE origin_hotmart_sale_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "financial_entries_lead_unique" ON "financial_entries" USING btree ("origin_lead_id") WHERE origin_lead_id is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_statement_imports_account_idx" ON "bank_statement_imports" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_statement_imports_created_at_idx" ON "bank_statement_imports" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bank_statement_lines_dedup_unique" ON "bank_statement_lines" USING btree ("dedup_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_statement_lines_import_idx" ON "bank_statement_lines" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_statement_lines_account_idx" ON "bank_statement_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_statement_lines_status_idx" ON "bank_statement_lines" USING btree ("status");--> statement-breakpoint
-- RLS: habilita em todas as tabelas novas do modulo financeiro (owner-only via
-- app/service_role; anon negado). Mesmo padrao da migracao 0011.
ALTER TABLE "financial_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_recurring_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ENABLE ROW LEVEL SECURITY;
