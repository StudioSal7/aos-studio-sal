CREATE TYPE "public"."contract_status" AS ENUM('rascunho');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"produto_id" uuid,
	"tipo" "product_tipo" NOT NULL,
	"dados" jsonb NOT NULL,
	"status" "contract_status" DEFAULT 'rascunho' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_contracts" ADD CONSTRAINT "lead_contracts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_contracts" ADD CONSTRAINT "lead_contracts_produto_id_products_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_contracts" ADD CONSTRAINT "lead_contracts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_contracts_lead_idx" ON "lead_contracts" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_contracts_created_at_idx" ON "lead_contracts" USING btree ("created_at");--> statement-breakpoint
-- Tabela nova nasce com RLS ligado. Sem policies permissivas — deny-all para
-- anon; a app usa service_role/conexão direta, que bypassa RLS (padrão do
-- repo, ver 0011_enable_rls_public_tables.sql).
ALTER TABLE "lead_contracts" ENABLE ROW LEVEL SECURITY;