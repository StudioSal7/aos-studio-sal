---
name: CRM Fase 1 — overview e contexto da operação
description: Projeto CRM para operação de mentoria de marca pessoal feminina; substitui Forms+planilha; é instrumento de medição, não solução de gargalo
type: project
originSessionId: 84bf1eda-8a11-4856-9aaa-6b5317039820
---
CRM Fase 1 sendo construído pra cliente que opera mentoria/consultoria de marca pessoal de alto ticket (operação consultiva premium feminina). Substitui Google Forms + planilha que rodam hoje.

**Posicionamento estratégico:** Fase 1 é **instrumento de medição**, não solução do gargalo. A cliente afirmou que "Fechado verbalmente" sangra mas é palpite — sem dado histórico pra validar. Construir as estruturas que coletam dado, não codificar premissas.

Why: cliente partiu da hipótese de gargalo no estágio 7, mas não tem dado pra confirmar. SLA hardcoded de 24h, projeção ponderada por % de fechamento, score numérico — tudo dependeria de dado que não existe.
How to apply: nenhuma feature da Fase 1 deve depender de dado histórico que não temos. SLA configurável, dashboard com pipeline bruto (sem ponderação), score em flags visuais (não número), threshold de "lista de revisão" como gate de qualidade.

**Volume e características da operação:**
- ~200 leads em 10 meses (jun/2025 a mai/2026), ~20/mês
- Operada hoje pela cliente sozinha (low-tech assumida) + 1 SDR + 1 closer
- Owner pode acumular papel de closer
- **Closer é gargalo de atualização de status na operação atual** — descoberto durante grilling. UI da Fase 1 precisa puxar disciplina (prompts ativos, baixa fricção), não exigir treinamento.
- Forms entram via **Respondi.app** (não via form nativo na Fase 1)

**Stack:**
- Next.js 15 App Router + Supabase (Postgres + Auth + RLS) + Drizzle ORM
- TypeScript estrito, Tailwind, shadcn/ui
- Monorepo Turborepo + pnpm
- Server Actions para mutações; Route Handlers para webhook
- Branch: `feat/crm-fase-1` a partir de `main`
- **Cenário 1: custom build pra UM cliente. SEM tenant_id em nenhuma tabela.** RLS via auth.uid() com role-based rules.
