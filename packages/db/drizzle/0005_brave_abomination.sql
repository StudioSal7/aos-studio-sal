ALTER TABLE "leads" drop column "whatsapp_digits_only";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "whatsapp_digits_only" text GENERATED ALWAYS AS (regexp_replace(whatsapp_e164, '[^0-9]', '', 'g')) STORED;--> statement-breakpoint
-- DROP COLUMN derruba o índice que dependia da coluna; o drizzle-kit não o recria. Recriar à mão.
CREATE INDEX IF NOT EXISTS "leads_whatsapp_digits_idx" ON "leads" USING btree ("whatsapp_digits_only");