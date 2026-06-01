CREATE TABLE IF NOT EXISTS "sal_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" text NOT NULL,
	"purchased_at" timestamp with time zone NOT NULL,
	"raw_status" text NOT NULL,
	"status" text NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_email" text NOT NULL,
	"buyer_phone_raw" text,
	"buyer_phone_e164" text,
	"product_name" text NOT NULL,
	"product_code" text NOT NULL,
	"commission_cents" integer NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"traffic_type" text NOT NULL,
	"raw_row" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sal_sales_transaction_id_unique" ON "sal_sales" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sal_sales_purchased_at_idx" ON "sal_sales" USING btree ("purchased_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sal_sales_product_code_idx" ON "sal_sales" USING btree ("product_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sal_sales_status_approved_idx" ON "sal_sales" USING btree ("status") WHERE status = 'approved';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sal_sales_utm_campaign_idx" ON "sal_sales" USING btree ("utm_campaign");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sal_sales_utm_term_idx" ON "sal_sales" USING btree ("utm_term");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sal_sales_utm_source_idx" ON "sal_sales" USING btree ("utm_source");