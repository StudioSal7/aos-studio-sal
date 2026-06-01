# CLAUDE.md — A Revolução Projeto 2

Contexto persistente para sessões Claude Code. Atualizar sempre que decisões ou estado mudarem.

---

## O que é este projeto

CRM customizado para operação de mentoria/consultoria de marca pessoal feminina.
- ~200 leads/ano via Respondi.app
- 1 owner (cliente) + 1 SDR + 1 closer
- Cenário 1: single-tenant, sem `tenant_id`
- PRD completo: [`docs/crm-fase-1/`](./docs/crm-fase-1/)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| App | Next.js 15 App Router, TypeScript strict |
| UI | Tailwind v4 CSS-first, shadcn/ui, Gowun Batang (next/font), lucide-react |
| ORM | Drizzle ORM + postgres.js |
| Banco | Supabase (Postgres + Auth) |
| Deploy | Vercel Pro |
| Testes | Vitest |

---

## Estrutura de pacotes

```
apps/
  crm/                    # CRM Fase 1 (Next.js)
    src/
      app/
        (crm)/            # Route group com sidebar — todas as rotas autenticadas
          kanban/         # Pipeline principal
          leads/[id]/     # Detalhe do lead
          busca/          # Busca pg_trgm
          quentes/        # Leads com next_action_at < 48h
          revisao/        # Leads needs_manual_review=true
          calendario/     # Meetings da semana
          dashboard/      # Pipeline bruto + métricas
          saude/          # Leads requires_attention=true
          admin/          # Owner only: users, estágios, catálogos
        api/
          webhooks/leads/respondi/  # Entrada de leads via Respondi.app
          crons/
            meeting-prompt/         # A cada 15min — marca needs_confirmation
            sla-check/              # 1x/dia — idle na Fase 1
            data-quality/           # Segunda 8h SP — popula saúde dos dados
        login/            # Página de login + actions
        auth/callback/    # Supabase Auth callback
      components/
        command-palette/  # Cmd+K palette (cmdk + Radix Dialog)
        ui/               # Button, Input, Textarea, Select, Label, Card, Modal, Badge, PageHeader
                          # sheet.tsx, tabs.tsx, command.tsx, action-feedback.tsx, kbd-hint.tsx
      server/
        actions/          # Server Actions: leads.ts, meetings.ts, users.ts, search.ts
        auth.ts           # requireAuth() → { userId, supabaseUserId, email, role }
        audit-writer.ts   # writeStageHistory() + writeFieldAudit() transacionais
        queries/          # leads.ts, dashboard.ts, search.ts
        lib/
          whatsapp-normalizer/      # deep module puro — normaliza para E.164
          respondi-payload-mapper/  # deep module puro — mapeia payload Respondi
          dedup-matcher/            # deep module — encontra lead duplicado no DB
          legacy-csv-parser/        # deep module — parseia CSV legado
          stage-transition-validator/ # deep module puro — valida transições
          search-query-builder/     # deep module — monta query pg_trgm
      lib/
        respondi-mapping.ts  # ⚠️ question_id → campo CRM (PLACEHOLDERS — ver abaixo)
        supabase/
          server.ts        # createSupabaseServerClient()
          client.ts        # createSupabaseBrowserClient()
      middleware.ts        # Protege rotas; redireciona para /login se sem sessão
    scripts/
      import-legacy.ts     # pnpm import-legacy <path.csv> → tmp/import-report.md
    vercel.json            # Cron schedules (UTC: 11h = 8h SP para data-quality/sla)
packages/
  db/                     # @repo/db — Drizzle schema + client + seed
    src/
      schema/             # 12 tabelas — ver abaixo
      seed.ts             # Estágios, motivos de perda, fontes
    drizzle.config.ts
  ui/                     # @repo/ui — shadcn/ui compartilhado
  config/                 # eslint, tsconfig, tailwind compartilhados
```

---

## Schema (12 tabelas)

| Tabela | Descrição |
|---|---|
| `users` | Usuários do CRM (owner/sdr/closer). Role em DB, não em Supabase metadata |
| `leads` | Entidade central. `stageId` FK para `lead_stages` |
| `lead_stages` | 11 estágios com `slug` imutável, `displayName` editável, `kind` (open/won/lost) |
| `lead_loss_reasons` | Motivos de perda (11 seedados + owner pode adicionar) |
| `lead_sources` | Origem do lead (5 seedadas + `outro`) |
| `lead_objections` | Vazio na seed — owner preenche via admin |
| `products` | Vazio na seed — owner preenche via admin |
| `meetings` | Reuniões agendadas/realizadas por lead |
| `lead_stage_history` | Append-only — cada mudança de estágio |
| `lead_field_audit` | Append-only — subset de campos críticos auditados |
| `lead_action_log` | Append-only — ações registradas |
| `lead_intake_log` | Append-only — log de webhooks e imports |

---

## Comandos

```bash
# Desenvolvimento
pnpm install
pnpm dev                    # Todos os apps em paralelo
pnpm --filter crm dev       # Só o CRM

# Banco
pnpm db:push                # Aplica schema (dev — sem migration)
pnpm db:generate            # Gera SQL de migration (prod)
pnpm db:migrate             # Aplica migration (prod)
pnpm db:seed                # Seed inicial (rodar após db:push)
pnpm db:studio              # Drizzle Studio

# Qualidade
pnpm test                   # Vitest (todos os pacotes)
pnpm --filter crm test      # Só CRM
pnpm typecheck              # tsc --noEmit

# Scripts
pnpm --filter crm import-legacy -- ./caminho/para/arquivo.csv
```

---

## Auth e permissões

- Supabase Auth: email + senha + invite flow
- Role armazenada em `users.role` (Drizzle), não em metadata Supabase
- `requireAuth()` em `apps/crm/src/server/auth.ts` → retorna `{ userId, supabaseUserId, email, role }`
- Todos os papéis leem tudo. Só `owner` deleta lead, edita catálogos, convida usuário
- RLS mínima: `anon` negado. Drizzle usa `service_role` (bypass RLS)
- Middleware protege todas as rotas exceto `/login` e `/auth/callback`

---

## Variáveis de ambiente

Copiar `.env.example` para `apps/crm/.env.local` e preencher:

```
NEXT_PUBLIC_SUPABASE_URL=          # Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Settings → API → anon/public
SUPABASE_SERVICE_ROLE_KEY=         # Settings → API → service_role (nunca expor no cliente)
DATABASE_URL=                      # Settings → Database → Connection string (URI)
WEBHOOK_TOKEN_RESPONDI=            # String aleatória longa — colar no painel Respondi
CRON_SECRET=                       # String aleatória longa — Vercel usa automaticamente
NEXT_PUBLIC_SITE_URL=              # URL do deploy Vercel (para redirects de invite)
NEXT_PUBLIC_OPERATION_TZ=America/Sao_Paulo
```

---

## Estado atual — Fase 1

### ✅ Implementado e testado

- Monorepo completo (Turborepo + pnpm workspaces)
- Schema Drizzle (12 tabelas) + seed (estágios, motivos, fontes)
- `whatsapp-normalizer` — 24 testes passando
- `respondi-payload-mapper` — 29 testes passando
- `dedup-matcher` — 8 testes (skip sem DATABASE_URL, integração)
- `legacy-csv-parser` — 32 testes passando
- `stage-transition-validator` — 8 testes passando
- Script `import-legacy.ts` — gera `tmp/import-report.md`
- Auth: `requireAuth()`, invite flow, login page, middleware, callback
- Webhook Respondi: `POST /api/webhooks/leads/respondi?token=...` + Zod + idempotência
- Server Actions: leads (stage, assign, fields, delete), meetings (schedule, reschedule, complete), users (invite)
- `audit-writer`: `writeStageHistory` + `writeFieldAudit` transacionais
- Kanban + drag-and-drop (dnd-kit) + optimistic update + Lost/Paid via `Sheet` (não modal fullscreen)
- Quick view lateral ao clicar no card do Kanban (`LeadQuickView` — Sheet ~480px)
- Busca global (`/busca`) com pg_trgm + prefix match
- Views: Quentes, Para revisão, Calendário, Dashboard, Saúde dos dados
- Lead detail com 4 tabs (Atividade, Info, Comercial, Histórico) + header fixo com badges e CTAs
- Timeline unificada na tab Atividade (reuniões + mudanças de estágio, ordem cronológica reversa)
- `ConfirmMeetingForm`: confirma se reunião aconteceu (chama `completeMeetingAction`)
- Cmd+K command palette: busca leads, navega entre views, atalhos `g k`/`g q`/`g c`/`g d`, ações contextuais no lead atual
- `ActionFeedback`: componente padronizado de feedback (idle → pending → success → error) em todos os forms
- `KbdHint`: atalhos visíveis ao lado dos CTAs principais (passive learning)
- Crons: `meeting-prompt` (15min), `sla-check` (idle), `data-quality` (seg 8h SP)
- Admin: lista de usuários, estágios, motivos de perda; `InviteUserForm`
- `vercel.json` com schedules dos 3 crons
- **Identidade visual Studio Sal**: tokens semânticos em `globals.css` (canvas/paper/ink/wood/leaf/clay), Gowun Batang via `next/font`, radius zerado em `@theme`, ícones lucide-react na sidebar, paleta terrosa nos sinais de lead
- Componentes UI locais em `apps/crm/src/components/ui/`: Button, Input, Textarea, Select, Label, Card, Modal, Badge, PageHeader + primitivos shadcn (Sheet, Tabs, Command)
- TypeScript: 0 erros (`tsc --noEmit`)
- Testes: 93 passando, 8 skipped (dedup integração), 0 falhas

### ✅ Infraestrutura conectada (concluído)

- Supabase: projeto `rxeuqivufpgkejoxwjxf` (us-east-1) — **"Projeto A revolução 2"**
- `.env.local` criado em raiz e em `apps/crm/` com todas as variáveis
- `DATABASE_URL` usa o Transaction pooler (porta 6543) — OK para runtime; usar Session pooler (porta 5432) se precisar de migrations futuras com prepared statements
- `drizzle.config.ts` carrega `.env.local` via `dotenv` (pacote instalado em `@repo/db`)
- `db:seed` usa `tsx --env-file=../../.env.local` para carregar env
- Migration `0000_pale_captain_stacy.sql` aplicada — 12 tabelas criadas + extensão `pg_trgm`
- Seed executado — 11 estágios, 11 motivos de perda, 6 fontes populados
- Usuário owner criado: `rodrigo@benitesalbuquerque.com.br` / senha temporária `Mudar@123`
- Import legado executado: **191 leads** do CSV do Respondi importados, 2 duplicatas detectadas
  - CSV: `Respondi _ Formulário aplicação _ branding essencial - Página1.csv`
  - Script usa `RESPONDI_COLUMN_MAP` customizado (colunas do Respondi diferem do `DEFAULT_COLUMN_MAP`)
  - Relatório em `apps/crm/tmp/import-report.md`

### ⚠️ Bugs corrigidos (não reverter)

- **Imports `.js`**: todos os arquivos em `packages/db/src/` e `apps/crm/src/server/lib/` tinham extensões `.js` nos imports relativos — removidas para compatibilidade com drizzle-kit (CJS) e Turbopack
- **Dashboard GROUP BY**: `getAvgTimePerStage` não incluía `leadStages.position` no `groupBy` — corrigido em `apps/crm/src/server/queries/dashboard.ts`
- **Serialização de Date no kanban**: `KanbanBoard` é client component — `Date` objects convertidos para ISO strings antes de passar como props (em `kanban/page.tsx`); tipos atualizados em `kanban-board.tsx`
- **`getHotLeads` ERR_INVALID_ARG_TYPE**: `sql` template literals do Drizzle com `Date` JavaScript direto causam `ERR_INVALID_ARG_TYPE` no Node.js (path de encoding interno). Corrigido em `server/queries/leads.ts` usando `lte()`/`gte()` em vez de `sql\`...\``.
- **`typedRoutes` + `router.push`**: com `experimental: { typedRoutes: true }`, `router.push(string)` falha. Corrigido com cast `href as Route<string>` (tipo de `next`). Mesmo padrão se necessário em outros client components que chamam `router.push` com string.

### ⚠️ Pendente antes do go-live

**1. Mapeamento dos question_id do Respondi** ⚠️ BLOQUEANTE para webhook
→ Arquivo: `apps/crm/src/lib/respondi-mapping.ts`
→ Hoje tem placeholders (`q_name`, `q_email`, etc.)
→ Para obter os IDs reais: no painel Respondi → Integrações → Webhook → Testar → inspecionar o payload raw → copiar o `id` de cada pergunta
→ Substituir os placeholders pelos IDs reais e fazer o mapeamento de cada campo

**2. Gerar e configurar `WEBHOOK_TOKEN_RESPONDI` e `CRON_SECRET`**
→ `openssl rand -hex 32` para cada um
→ Adicionar em `apps/crm/.env.local` e no painel do Vercel

**3. Configurar webhook no painel Respondi**
→ URL: `https://<seu-projeto>.vercel.app/api/webhooks/leads/respondi?token=<WEBHOOK_TOKEN_RESPONDI>`
→ Confirmar que Respondi dispara apenas em `status='completed'`

**4. Deploy no Vercel**
→ Conectar repositório → configurar variáveis de ambiente no painel Vercel
→ Atualizar `NEXT_PUBLIC_SITE_URL` para a URL de produção

**5. Onboarding do time**
→ Owner convida SDR e closer via `/admin`
→ Cada um recebe email, define senha, faz login
→ Owner preenche `products` e `objections` via admin conforme operação usar

---

## Decisões arquiteturais importantes

- **Slugs dos estágios são imutáveis** — `displayName` é editável, `slug` não. Código referencia slugs (ex: `'paid'`, `'lost'`).
- **Todas as datas em UTC no banco** — exibição sempre em `America/Sao_Paulo` via `date-fns-tz`
- **Audit app-side** — não usa triggers Postgres. `writeStageHistory` e `writeFieldAudit` rodam na mesma transaction da mutação.
- **`@repo/db` tem 3 export paths**: `.` (barrel completo), `./schema` (sem inicializar client — seguro em testes), `./client` (exige DATABASE_URL). Importar `./schema` em deep modules para não quebrar testes sem banco.
- **Drag-and-drop any-to-any** — sem restrição de sequência, exceto validação inline em `lost` (motivo obrigatório) e `paid` (valor + forma de pagamento obrigatórios).
- **Lost/Paid usa Sheet, não modal** — `Sheet` do shadcn permite que o board fique visível ao fundo. Cancelar (Esc) ou clicar fora faz rollback do optimistic move.
- **Lead detail com tabs e URL state** — tab ativa persiste em `?tab=atividade` via `searchParams` no Server Component. Default: `atividade`.
- **Cmd+K context-aware** — ações de "lead atual" (mover estágio, agendar, nota) só aparecem na rota `/leads/[id]`. Usa `usePathname()` para detectar contexto.
- **`sql` template + Date → usar operadores tipados** — interpolar `Date` JS em `sql\`...\`` do Drizzle causa `ERR_INVALID_ARG_TYPE`. Sempre usar `lte()`, `gte()`, `eq()` etc.
- **Dedup por email OR whatsapp normalizado E.164** — webhook faz upsert se encontrar match.
- **Middleware não protege `/api/`** — autenticação das routes de API é feita internamente (`CRON_SECRET`, `WEBHOOK_TOKEN_RESPONDI`).
- **Design system via tokens CSS, não classes** — cores semânticas (`canvas/paper/ink/wood/leaf/clay`) definidas em `@theme` no `globals.css`. Radius zerado no `@theme` (não no JSX). Tipografia hierárquica como `@utility` compostos (`text-display/h2/h3/body/btn/micro`). Adicionar tokens aqui, não criar classes utilitárias ad hoc.
- **`rounded-full` é a única exceção ao radius zero** — preservado propositalmente para dots de status e avatares.
- **Lowercase editorial via CSS** — `text-transform: lowercase` nas utilities `text-display/h2/h3/btn`. Usar `normal-case` para exceções pontuais (nomes próprios).

---

## Critério de pronto da Fase 1

1. Webhook Respondi criando lead em produção automaticamente
2. Import do legado executado + relatório publicado
3. Time arrasta leads entre estágios com validação inline
4. Dashboard com pipeline bruto + contagens + tempo médio
5. Busca por apelido curto funcionando (Bi, Ju)
6. Fila "Para revisão" zerada pelo menos uma vez
7. 3 papéis com login funcionando, owner não acessível por SDR/closer
8. Nenhum lead duplicado em 30 dias
9. View "Saúde dos dados" acionável (cron rodando)
10. `meeting-prompt` cron marcando `needs_confirmation` corretamente
