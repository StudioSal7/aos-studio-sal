CREATE TYPE "public"."product_tipo" AS ENUM('mentoria', 'infoproduto');--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "valor_cents" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tipo" "product_tipo";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "produto_fechado_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_produto_fechado_id_products_id_fk" FOREIGN KEY ("produto_fechado_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
