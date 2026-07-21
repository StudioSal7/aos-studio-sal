CREATE TABLE IF NOT EXISTS "financial_categorization_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern" text NOT NULL,
	"category_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD COLUMN "suggested_category_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_categorization_rules" ADD CONSTRAINT "financial_categorization_rules_category_id_financial_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."financial_categories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_categorization_rules_active_idx" ON "financial_categorization_rules" USING btree ("active");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_suggested_category_id_financial_categories_id_fk" FOREIGN KEY ("suggested_category_id") REFERENCES "public"."financial_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "financial_categorization_rules" ENABLE ROW LEVEL SECURITY;
