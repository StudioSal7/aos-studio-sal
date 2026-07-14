-- Habilita RLS em todas as tabelas do schema public expostas via API.
-- Seguro: o app acessa via service_role/conexão direta (ignora RLS); só o
-- acesso anônimo externo (PostgREST) passa a ser negado, que é o desejado
-- ("anon negado"). Sem policies permissivas — deny-all para anon.
-- Corrige os 21 erros "RLS Disabled in Public" do Supabase linter (2026-07-13).
--> statement-breakpoint
ALTER TABLE "commercial_analyses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "form_fields" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "form_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_action_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_field_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_intake_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_loss_reasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_objections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_stage_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roleplay_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roleplay_scenarios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roleplay_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sal_sales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
