ALTER TABLE "commercial_analyses" ADD COLUMN "closer_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commercial_analyses" ADD CONSTRAINT "commercial_analyses_closer_id_users_id_fk" FOREIGN KEY ("closer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
