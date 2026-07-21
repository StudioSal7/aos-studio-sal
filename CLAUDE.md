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

## Schema (21 tabelas)

| Tabela | Descrição |
|---|---|
| `users` | Usuários do CRM (owner/sdr/closer). Role em DB, não em Supabase metadata |
| `leads` | Entidade central. `stageId` FK para `lead_stages` |
| `lead_stages` | 11 estágios com `slug` imutável, `displayName` editável, `kind` (open/won/lost) |
| `lead_loss_reasons` | Motivos de perda (11 seedados + owner pode adicionar) |
| `lead_sources` | Origem do lead (5 seedadas + `outro`) |
| `lead_objections` | Vazio na seed — owner preenche via admin |
| `products` | Catálogo (nome, `valorCents` integer, `tipo` mentoria/infoproduto, `active`). Seed: 3 slugs do bio.config.ts (metodo-sal, mentoria-salto, central-conteudo) sem preço — owner completa via `/admin/produtos` |
| `meetings` | Reuniões agendadas/realizadas por lead |
| `lead_stage_history` | Append-only — cada mudança de estágio |
| `lead_field_audit` | Append-only — subset de campos críticos auditados |
| `lead_action_log` | Append-only — ações registradas |
| `lead_intake_log` | Append-only — log de webhooks e imports |
| `sal_sales` | Vendas Sal (owner only) |
| `commercial_analyses` | Análises CallScore (closer/sdr) — `score_breakdown`/`extracted_data` jsonb |
| `roleplay_scenarios` | Cenários de treino SPIN (persona/contexto/objeções do lead simulado) |
| `roleplay_sessions` | Sessões de treino — `overall_score` (CHECK 0–100), `score_breakdown`/`feedback` jsonb |
| `roleplay_messages` | Mensagens da sessão (append-only) — `role` prospect/closer/system, `turn_index` |
| `forms` | Formulários self-hosted (substituem o Respondi) — `slug` único, `status` rascunho/ativo/pausado/encerrado, `config` jsonb (tema/redirect/UTM/**backgroundImage**) |
| `form_fields` | Campos do formulário — 13 tipos, `ordem`, `config` jsonb, **`lead_mapping`** (coluna do lead) + **`lead_enum_map`** jsonb (opção→literal de enum) |
| `form_responses` | Respostas cruas (auditoria) — `dados` jsonb, `lead_id` FK (set null), `metadata` UTM |
| `google_accounts` | Contas Google conectadas (OAuth, agenda da Renata) — tokens nullable (disconnect anula), `google_email` UNIQUE, RLS desde a criação. `meetings` ganhou `google_event_id` + `google_account_id` FK (set null) |
| `metric_targets` | Metas do semáforo do dashboard (owner, via admin) — `metric_key` único (catálogo em código), `comparator` (gte/lte), `threshold`/`yellow_margin` numeric. Vazia = nada colore |

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
pnpm --filter crm analyze-closer-batch -- ./caminho/para/transcricoes/   # lote closer (.txt)
pnpm --filter crm analyze-sdr-batch                                      # lote SDR (lê store Evolution)
pnpm --filter crm seed-aplicacao-sal                                     # cria form aplicacao-sal no banco (idempotente)
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
- **Formulários self-hosted (substituem o Respondi)**: motor Typeform portado do `ba-hub`, re-tematizado com tokens Studio Sal. Builder admin owner-only (`(crm)/admin/formularios/`: lista, editor com dnd-kit + autosave, respostas), 13 tipos de campo, rota pública `/f/[slug]` (fora do auth, liberada no middleware), submit em `POST /api/forms/submit` → cria lead pelo MESMO pipeline do Respondi (dedup + `application_received`). Suporte a imagem de fundo via `config.backgroundImage` + classe CSS `.form-on-photo` (tokens invertidos para fundo escuro). Detalhe na seção de decisões.
- **Form `aplicacao-sal`**: réplica do formulário Respondi com 17 telas, fundo `sal-fundo.jpg` (foto botânica escura), seed idempotente via `pnpm --filter crm seed-aplicacao-sal`. Já gravado no banco de produção. URL: `/f/aplicacao-sal`.
- **Dossiê do lead (aba "informações")**: a aba "informações" do card vira um dossiê de leitura que centraliza identificação + qualificação (com labels legíveis nos enums) + origem + **dados extraídos das calls** (`commercial_analyses`, resumo + link) + **respostas verbatim de todos os formulários** que o lead preencheu (`form_responses`, incluindo campos sem `lead_mapping` como o multi-select "desafios"). A aba "comercial" fica só com o workflow de venda. Evento clicável "formulário preenchido" na timeline → deep-link `?tab=info#resp-<id>`. Abas com estado real na URL. Detalhe na seção de decisões.
- **Catálogo de produtos (`/admin/produtos`) + vínculo no fechamento**: CRUD owner-only (criar/editar/ativar-desativar) sobre a `products` já existente, estendida com `valorCents` (integer cents) e `tipo` (enum `mentoria`/`infoproduto`, migration 0014). Fechar um lead (mover pro estágio `paid`) agora **exige selecionar um produto** do catálogo — `PaidForm` no Kanban preenche o valor a partir do produto escolhido, mas o valor **continua editável** (desconto/custom). Persistido em `leads.produtoFechadoId` (novo, distinto de `produtoInteresseId` — upsell/downsell podem divergir), auditado em `lead_field_audit`. `stage-transition-validator` bloqueia `paid` sem produto (`produto_required`). Detalhe na seção de decisões.
- TypeScript: 0 erros (`tsc --noEmit`)
- Testes: 239 passando, 8 skipped (dedup integração), 0 falhas

### ✅ Infraestrutura conectada (concluído)

- Supabase: projeto `fyhcpftzqczplmtykxke` (novo projeto após migração de `rxeuqivufpgkejoxwjxf`)
- `.env.local` criado em raiz e em `apps/crm/` com todas as variáveis do novo projeto
- `DATABASE_URL` usa Direct connection (porta 5432) — necessário para `db:migrate` e `db:push`
- `drizzle.config.ts` carrega `.env.local` via `dotenv` (pacote instalado em `@repo/db`)
- `db:seed` usa `tsx --env-file=../../.env.local` para carregar env
- Migration `0000_pale_captain_stacy.sql` aplicada + coluna `pontuacao` adicionada via `ALTER TABLE` (não estava na migration original — foi adicionada ao schema após a geração inicial)
- Seed executado — 11 estágios, 11 motivos de perda, 6 fontes populados
- Usuário owner criado: `rodrigo@benitesalbuquerque.com.br` / senha temporária `Mudar@123`
- Import legado executado: **191 leads** do CSV do Respondi importados, 2 duplicatas detectadas
  - CSV: `Respondi _ Formulário aplicação _ branding essencial - Página1.csv`
  - Script usa `RESPONDI_COLUMN_MAP` customizado (colunas do Respondi diferem do `DEFAULT_COLUMN_MAP`)
  - Relatório em `apps/crm/tmp/import-report.md`
- Git inicializado + repositório conectado: `https://github.com/StudioSal7/aos-studio-sal` (migrado de `rodrigo3vium/aos-studio-sal` — remote `origin` atualizado em 2026-06-25)
- Código pusado para branch `main` (145 arquivos, sem `.env.local`)

### ⚠️ Bugs corrigidos (não reverter)

- **Imports `.js`**: todos os arquivos em `packages/db/src/` e `apps/crm/src/server/lib/` tinham extensões `.js` nos imports relativos — removidas para compatibilidade com drizzle-kit (CJS) e Turbopack
- **Dashboard GROUP BY**: `getAvgTimePerStage` não incluía `leadStages.position` no `groupBy` — corrigido em `apps/crm/src/server/queries/dashboard.ts`
- **Serialização de Date no kanban**: `KanbanBoard` é client component — `Date` objects convertidos para ISO strings antes de passar como props (em `kanban/page.tsx`); tipos atualizados em `kanban-board.tsx`
- **`getHotLeads` ERR_INVALID_ARG_TYPE**: `sql` template literals do Drizzle com `Date` JavaScript direto causam `ERR_INVALID_ARG_TYPE` no Node.js (path de encoding interno). Corrigido em `server/queries/leads.ts` usando `lte()`/`gte()` em vez de `sql\`...\``.
- **`typedRoutes` + `router.push`**: com `experimental: { typedRoutes: true }`, `router.push(string)` falha. Corrigido com cast `href as Route<string>` (tipo de `next`). Mesmo padrão se necessário em outros client components que chamam `router.push` com string.
- **`import-legacy.ts` + `scheduledAt NOT NULL`**: script não passava `scheduledAt` ao criar reunião placeholder para leads com status `reunião agendada`/`reagendar encontro`. Corrigido em `apps/crm/scripts/import-legacy.ts` usando `lead.receivedAt` como fallback.
- **`DATABASE_URL` com `%` na senha**: caractere `%` em senha do Supabase precisa ser URL-encoded como `%25` para não quebrar o parse URI do `postgres.js`. Corrigido no `.env.local` da raiz e de `apps/crm/`.
- **`sql` template + `Date` em `getAnalysisKpis`**: mesmo padrão do `getHotLeads` — `startOfMonth` (Date JS) interpolado em `sql\`...\`` causa `ERR_INVALID_ARG_TYPE`. Corrigido em `apps/crm/src/server/queries/commercial.ts` usando `.toISOString()::timestamptz` em vez de passar o objeto Date diretamente.
- **`leads.whatsapp_digits_only` gerada com `\D` → ficava com `+`** (migration `0005_brave_abomination`): a expressão `regexp_replace(whatsapp_e164, '\D', ...)` perdia o backslash na geração da migration (virava `'D'` no banco), então a coluna mantinha o `+` e **todo match por dígitos quebrava** (`getLeadByWhatsappDigits`, usado na UI de análise SDR Porta 2 e no lote). Corrigido para classe inequívoca `'[^0-9]'`. **Em coluna gerada, nunca usar `\d`/`\D` no `regexp_replace` — usar classe `[0-9]`/`[^0-9]`.** Trocar a expressão de uma coluna `GENERATED ALWAYS` exige `DROP`+`ADD` (Postgres não altera a expressão in-place) e **recriar o índice** que dependia dela (`leads_whatsapp_digits_idx`) — o drizzle-kit dropa a coluna mas não recria o índice.
- **Formulário self-hosted nunca submetia na tela de encerramento** (`form-runtime.tsx`): a tela `encerramento` ("recebemos sua aplicação!") não tinha botão de envio — nav ↑↓ e botão "ok" ficam escondidos nela, e o POST só disparava com Enter (que ninguém aperta numa tela que parece de confirmação). Resultado: **lead nunca criado, 0 `form_responses`**. Corrigido com **auto-submit ao chegar na tela de encerramento** (guardado por `useRef` p/ 1 disparo, sem loop) + feedback honesto (`ClosingSending`/`ClosingError` com retry). `useTypeform.submit` retorna `Promise<boolean>`. **Regra: toda tela de "obrigado" que aparece ANTES do submit é armadilha — o envio tem que disparar junto com a tela que o promete.**
- **Kanban com scroll vertical fantasma cortando os cards** (`kanban-board.tsx`/`kanban-column.tsx`): o container de colunas tinha `overflow-x-auto` sem conter o eixo Y, e CSS promove `overflow-y: visible` → `auto` quando o outro eixo é `auto`. Ao rolar até o fim e voltar, sobrava uma barra cortando os cards. Corrigido com `min-h-0 overflow-y-hidden` no container e `overflow-y-auto` na área droppable de cada coluna (cada coluna rola internamente).
- **Lead Bruna Neiman com campos deslocados 1 coluna** (linha 194 do CSV legado): a linha não tinha o campo de status inicial (todas as outras começam com `pendente,`/`recusada,`), então os valores entraram shiftados (nome←apelido, email←telefone, instagram←renda…). Corrigido pontualmente via `scripts/fix-shifted-lead.ts`. Só essa linha; outras 190 OK.
- **`pnpm lint` nunca rodou de verdade** (descoberto no merge da branch `feat/produtos-admin`): `packages/config/eslint/base.js` importa o pacote unscoped `typescript-eslint`, que nunca foi declarado como dependência em lugar nenhum do monorepo — `next lint` sempre falhava no import antes de lintar qualquer arquivo (confirmado pré-existente em checkout limpo de `main`). Corrigido: `typescript-eslint` declarado como devDependency em `@repo/config` (alinhado à versão já resolvida de `@typescript-eslint/*`, 8.59.3). Isso expôs um segundo bug latente: `next/typescript` (via `FlatCompat`, em `packages/config/eslint/next.js`) registra seu próprio objeto de plugin `@typescript-eslint`, colidindo com o já registrado por `tseslint.configs.recommended` no `baseConfig` — ESLint 9 flat config rejeita dois objetos de plugin distintos sob a mesma chave (`"Cannot redefine plugin"`). Corrigido removendo o registro duplicado das configs vindas do `compat.extends`, mantendo as regras de `next/typescript` intactas.
- **KPI "não trabalhadas" do dashboard filtrava por `displayName` editável**: `getPipelineCounts` (`server/queries/dashboard.ts`) não selecionava `slug`, então o consumo comparava `stageDisplayName === 'Aplicação recebida'` — renomear o estágio no admin zerava o KPI silenciosamente. Corrigido selecionando `stageSlug` e filtrando por `stageSlug === 'application_received'` (mesmo padrão de `getConversaoPorFonte`, hoje removida). **Regra: nunca filtrar por `displayName` no código — só `slug` é estável.**

### ⚠️ Pendente antes do go-live

**0. Backlog de lint pré-existente** (exposto ao corrigir o item acima — nunca visto antes porque `lint` nunca rodava)
→ ~20 erros/warnings em arquivos sem relação com produtos/contrato: `comercial/treino` (`start-session-form.tsx` — `<a>` em vez de `<Link/>`; `page.tsx` — var não usada), `dashboard/page.tsx` (var não usada), `tarefas/page.tsx` (várias `react/no-unescaped-entities`), `vendas-sal/page.tsx` (import não usado), `api/crons/data-quality` e `sla-check` (console.log fora do allowlist `warn`/`error`), `components/forms/fields.tsx` (`react-hooks/exhaustive-deps`), `server/lib/legacy-csv-parser` (função não usada), `server/lib/rate-limit` (import type), `server/lib/whatsapp-normalizer` (escape desnecessário em regex)
→ Decisão confirmada com o Rodrigo (2026-07-19): não bloqueia o merge da produtos/contrato — typecheck+test bastam como gate por ora. Tratar numa sessão dedicada de limpeza de lint.

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
- **Pool de conexões: `max: 10` (NUNCA baixar) por causa do POOLER do Supabase + pipelining do postgres.js** — a Vercel usa o POOLER do Supabase (Supavisor transaction mode, porta 6543; `prepare: false` é OBRIGATÓRIO). O `postgres.js` faz **pipelining** de queries quando há mais queries concorrentes que conexões no pool; contra o pooler em transaction mode, pipeline PROFUNDO (max baixo + muitas queries, como o dashboard ~18) faz algumas queries **travarem pra sempre** → a função estoura o `maxDuration` (60s no Hobby) → `FUNCTION_INVOCATION_TIMEOUT`, que a UI vê como "Connection closed". **Reproduzido:** 18 queries no pooler com `max:3` → 3 travam; `max:5/10/20` → todas OK. Regra: **manter `max ≥ 10`** e **não deixar uma página disparar dezenas de queries concorrentes** (preferir agrupadas — `getWeeklyFunnel` 3 queries com `FILTER` em vez de 32; `getCommercialFunnelCounts` 3 em vez de 14). Migrations (db:push/migrate) usam a conexão DIRETA 5432 (local `.env.local`). Diagnóstico completo em [`docs/debug-dashboard-timeout.md`](./docs/debug-dashboard-timeout.md). ⚠️ **Erro histórico a não repetir:** baixar `max` para "proteger contra exaustão de conexão" — a Vercel usa o pooler, não a direta, então exaustão da direta (limite 60) nunca foi o problema; `max` baixo só PIORA (garante o hang do pipelining).
- **Drag-and-drop any-to-any** — sem restrição de sequência, exceto validação inline em `lost` (motivo obrigatório) e `paid` (valor + forma de pagamento obrigatórios).
- **Lost/Paid usa Sheet, não modal** — `Sheet` do shadcn permite que o board fique visível ao fundo. Cancelar (Esc) ou clicar fora faz rollback do optimistic move.
- **Lead detail com tabs e URL state** — tab ativa persiste em `?tab=atividade` via `searchParams` no Server Component. Default: `atividade`.
- **Cmd+K context-aware** — ações de "lead atual" (mover estágio, agendar, nota) só aparecem na rota `/leads/[id]`. Usa `usePathname()` para detectar contexto.
- **`sql` template + Date → usar operadores tipados ou `.toISOString()`** — interpolar `Date` JS em `sql\`...\`` do Drizzle causa `ERR_INVALID_ARG_TYPE`. Em operadores Drizzle usar `lte()`, `gte()`, `eq()`. Em expressões `FILTER (WHERE ...)` que exigem `sql\`...\``, usar `.toISOString()` + cast `::timestamptz`.
- **Dedup por email OR whatsapp normalizado E.164** — webhook faz upsert se encontrar match.
- **Middleware não protege `/api/`** — autenticação das routes de API é feita internamente (`CRON_SECRET`, `WEBHOOK_TOKEN_RESPONDI`).
- **Design system via tokens CSS, não classes** — cores semânticas (`canvas/paper/ink/wood/leaf/clay`) definidas em `@theme` no `globals.css`. Radius zerado no `@theme` (não no JSX). Tipografia hierárquica como `@utility` compostos (`text-display/h2/h3/body/btn/micro`). Adicionar tokens aqui, não criar classes utilitárias ad hoc.
- **`rounded-full` é a única exceção ao radius zero** — preservado propositalmente para dots de status e avatares.
- **Lowercase editorial via CSS** — `text-transform: lowercase` nas utilities `text-display/h2/h3/btn`. Usar `normal-case` para exceções pontuais (nomes próprios).
- **Análise closer = régua v2 (Winning by Design, `@repo/commercial`)** — avalia EXECUÇÃO DO MÉTODO, nunca se fechou. 7 blocos A–G (0–10), **pesos variáveis por etapa** (`fechamento`/`diagnostico`), nota global calculada no código ×10 → **0–100** (mantém o anel/CHECK). Dossiê (detecção + leitura + desejo/implicação + acertos/falhas com trecho literal + sinais vermelhos + recomendações com script) gravado no jsonb `score_breakdown`; extração de negócio no `extracted_data`. **1 chamada gpt-4o** unificada. Detalhe completo em [`docs/estado-atual.md`](./docs/estado-atual.md).
- **gpt-4o em todas as análises (closer e SDR), nunca fatiar a transcrição** — Tier OpenAI atual gpt-4o = 30k TPM. Throughput: limpeza determinística por código (preserva falas) → compressão extrativa via mini só se exceder `TRANSCRIPT_CEILING=22000` → batch com throttle `THROTTLE_MS=65000` + backoff/Retry-After em 429. `openai.ts` falha explicitamente em `finish_reason='length'` (nunca grava dossiê parcial).
- **Lote SDR via Evolution = `apps/crm/scripts/analyze-sdr-batch.ts`** (`pnpm --filter crm analyze-sdr-batch`). Lê SÓ do store local (`findChats`/`findMessages`) — **nunca** desconecta/reescaneia/força sync (risco de ban). Espelha o lote closer: idempotência por `source_file` = `remoteJid` (+ skip se o lead já tem SDR), status `processando→concluido/erro`, `nao_aplicavel` sem nota. Diferenças: throttle leve `SDR_BATCH_THROTTLE_MS=3000` (leitura local); **loop por orçamento** (`MAX_BATCH` = nº de ANÁLISES, varre até `SDR_BATCH_SCAN`) para que conversas puladas não consumam slots; resumo ranqueado lido do banco; classifica skip `sem_resposta_sdr` (lead falou, SDR não respondeu) à parte. Match lead⇄conversa por mapa em memória derivado de `whatsapp_e164` (não usa a coluna gerada). Encerra com `process.exit(0)` (o `@repo/db/client` não expõe `client.end()`).
- **⚠️ Store da Evolution NÃO tem histórico das conversas dos leads do CRM** (descoberto 06/2026): os leads cadastrados têm ~1 mensagem cada no store (histórico não sincronizado), inclusive sob `@lid`. As conversas com histórico real (~20–35 msgs, analisáveis) são com números **fora** da base de leads. Conclusão: lote SDR pontua conversas ricas (geralmente sem `lead_id`); leads do CRM caem em `sem_resposta_sdr`/`not_commercial`. Completar o histórico exigiria sync — proibido pela regra de segurança.
- **Treino comercial = role-play SPIN (`@repo/commercial/roleplay`, régua `roleplay-spin-v1`)** — a closer conversa com um "lead" simulado por IA e treina perguntas SPIN. Motor puro (sem DB): `runRoleplayTurn` (turno de chat, `callGPT4oChat` texto multi-turno, temp 0.7) + `runRoleplayAnalysis` (**end-of-session, 1 chamada gpt-4o unificada**: notas 0–10 por critério + dossiê) + `scenarioFromTranscript` (rascunho persona/contexto/objeções p/ revisão humana). **5 critérios** (situação 10, problema 15, implicação 30, necessidade 30, condução&escuta 15 → soma 100): modelo devolve `nota_0_10` + texto, **nota global 0–100 calculada no código** (`computeRoleplayOverallScore`, ×10 clampado). NUNCA scoring ao vivo por turno. Dossiê (leitura 1 linha, 3 melhores momentos com trecho literal, 3 perguntas fracas + reescrita, 2 perguntas-modelo, próximo foco) gravado no jsonb `feedback`; notas em `score_breakdown`. **Persona/contexto/objeções vêm de `roleplay_scenarios` (dados), quem treina de `trainee_label` (dropdown derivado de `users.role='closer'`) — zero string de cliente no core.** UI em `(crm)/comercial/treino/` (lista+tendência, `[sessionId]` chat+dossiê com `maxDuration=300`, `cenarios` CRUD com `maxDuration=60`). Actions/queries em `server/actions/treino.ts` e `server/queries/treino.ts`. Mensagens persistidas em `roleplay_messages` (treino É gravado — diferente da decisão WhatsApp/SDR).
- **Formulários self-hosted = substituem o Respondi.app (motor portado do `ba-hub`, sem package novo — vive em `apps/crm`).** 3 tabelas (`forms`/`form_fields`/`form_responses`). **Submit cria lead pelo MESMO pipeline do webhook Respondi**, via módulo compartilhado novo `server/lib/lead-intake/ingestLead` (dedup por email/whatsapp/respondent_id → `application_received` → insert/upsert → `lead_intake_log` source `formulario_web`). O webhook Respondi ficou **intocado** (fatiar, não quebrar). `ingestLead` ainda **fecha o gap `leadSourceSlug→leadSourceId`** que o webhook nunca resolveu. Tradução resposta→`ParsedLead` no deep module puro `server/lib/form-answer-mapper` (14 testes, reusa o type `ParsedLead`). **Mapeamento campo→lead é dado, não código**: cada campo tem `lead_mapping` (coluna do lead) e, para enums (`idadeFaixa`/`abordagemPreferida`/`tempoNoNichoFaixa`), `lead_enum_map` (opção→literal, **lookup EXATO no submit, sem heurística** — miss → campo null + `needsManualReview=true` reason `form_enum_unmatched:*`, cai em `/revisao`). Default de origem = slug `formulario` quando o form não mapeia. Runtime público `/f/[slug]` (Server Component, `force-dynamic`, **fora do `(crm)`**, `/f/` liberado em `PUBLIC_PATHS` no middleware; só `status='ativo'` renderiza, senão `notFound()`). Submit em `POST /api/forms/submit` (público — middleware isenta `/api/`; valida `ativo` + campos server-side reusando `validation.ts`). **Sem framer-motion** — transição CSS. Builder owner-only autosave (cada edição dispara a action; reorder via dnd-kit persiste `ordem`). UI em `(crm)/admin/formularios/` (lista, `[id]` editor, `[id]/respostas`). Actions/queries em `server/actions/forms.ts` e `server/queries/forms.ts`. Seed de exemplo: `pnpm --filter crm seed-form-example` (form `aplicacao-exemplo`). **Imagem de fundo**: `FormConfig.backgroundImage` (URL relativa ou absoluta) → `form-runtime.tsx` aplica inline `background-image` + overlay `bg-black/45` + classe `.form-on-photo` que sobrescreve todos os tokens de cor para valores brancos/transparentes (`--color-ink: #fff`, `--color-paper: rgba(255,255,255,0.07)`, etc.) via CSS custom property cascade — sem passar prop por cada campo. Botões (`WelcomeField` + ok) trocam de `bg-ink` para `bg-wood` (verde-oliva `#6b7843` no modo foto). `WelcomeField.subtitulo` usa `whitespace-pre-line` para renderizar `\n` literais. Form concreto: `aplicacao-sal` (slug), 17 telas, `/f/aplicacao-sal`.
- **Sinal de primeiro contato pendente no Kanban** — pílula no card: `atender agora` (<24h, `text-leaf`, calmo) / `atrasado` (≥24h, `bg-signal-hot text-paper`, forte, + idade ex. `atrasado · 3d`) nos estágios pré-contato (`application_received`/`under_review`/`qualified`); some ao chegar em `first_contact_sent`. Derivado **server-side** na montagem do Kanban (`kanban/page.tsx`) pelo módulo puro `server/lib/first-contact-urgency` (`computeFirstContactSignal`, 7 testes) a partir de `leads.application_received_at` (coluna nullable, preenchida **só na entrada ao vivo** — `ingestLead` + webhook Respondi; legados null → sem sinal). **Sem cron, sem flag manual**: a ação que limpa o sinal é a SDR mover o card. SLA = 24h. Pílula é **ortogonal** às bordas `requiresAttention`/`needsManualReview` (coexistem). Fundamentação speed-to-lead + spec em `docs/superpowers/specs/2026-06-30-sinal-primeiro-contato-pendente-design.md`.
- **Tempo até o 1º contato (métrica de SDR)** — `leads.first_contact_at` (coluna nullable) grava o **primeiro** momento em que o lead sai do pré-contato para o caminho de contato (`first_contact_sent`+, exceto `lost`), via `updateLeadStageAction` na mesma transação do `writeStageHistory`, com guard set-once (`undefined` não altera). Predicado puro `reachesFirstContact` + `CONTACT_PATH_STAGE_SLUGS` em `server/lib/first-contact-urgency`. Métrica do dashboard "tempo até 1º contato" = `first_contact_at − application_received_at`, agregada por `server/lib/first-contact-metric` (mediana + % no SLA de 24h; mediana porque a distribuição é torta). Legados sem `application_received_at` ficam fora (sem início confiável → base começa pequena e cresce). Backfill histórico via `pnpm --filter crm backfill-first-contact-at` (reconstrói de `lead_stage_history`). Plano: `docs/superpowers/plans/2026-06-30-tempo-primeiro-contato.md`.
- **Funil comercial conta reunião pelo kanban, não pela tabela `meetings`** — em `server/queries/commercial-funnel.ts`, `getMeetingsScheduledCount`/`getMeetingsAttendedCount` leem de `lead_stage_history` (transições para `meeting_scheduled`/`meeting_done`), mesma fonte de proposta/venda (`getLeadsReachedStageCount`). Motivo: o time trabalha no **kanban** — arrastar o card É o evento; a tabela `meetings` só é populada pelo formulário na tela do lead, que a operação nem sempre usa, então antes reunião "não computava" no funil. Trade-off aceito: perde o detalhe no-show/cancelada da tabela `meetings` (o estágio `meeting_done` já significa realizada). O funil "por status" antigo (`getPipelineCounts`) segue sendo **foto do agora**; o funil comercial e a evolução semanal são **fluxo** (contam transições no período).
- **Catálogo de produtos + vínculo no fechamento** — `products` (já existente, antes vazia/sem uso) ganhou `valorCents` (integer cents — **dinheiro em cents em todo lugar, formatação só na exibição** via `src/lib/money.ts`) e `tipo` (enum `mentoria`/`infoproduto`, migration 0014). **Colunas legadas `kind`/`ticketMin`/`ticketMax` não foram tocadas** (extensão aditiva, sem uso conhecido no código — "estender sem quebrar"). CRUD owner-only em `/admin/produtos` (`server/actions/products.ts` + `server/queries/products.ts`), mesmo padrão de `forms.ts` (slug auto-gerado + `uniqueSlug`, `requireRole(auth,'owner')`). **Decisão confirmada com o Rodrigo**: produto é **obrigatório** para fechar (mover pro estágio `paid`) — `stage-transition-validator` ganhou o motivo `produto_required` ao lado de `valor_e_forma_required`. `leads.produtoFechadoId` (novo FK, distinto de `produtoInteresseId` — o interesse pré-venda do quiz "Direcionador" pode divergir do que de fato fechou por upsell/downsell) é auditado em `lead_field_audit` como os demais campos do fechamento. No Kanban, `PaidForm` ganhou um `<select>` de produto que **preenche o valor a partir do catálogo mas mantém editável** (desconto/custom) — `products` ativos chegam via prop desde `kanban/page.tsx` (`listActiveProducts()`). Seed popula os 3 slugs do `bio.config.ts` do site (`giulia-salvatore-site`, repo separado) que o endpoint `bio-lead` (branch `feat/bio-lead-direcionador`, ainda não mergeada) espera — **preço fica em branco de propósito** (não inventar dado financeiro sem fonte) até o owner preencher via admin.
- **Agenda Google da Renata = mão única CRM→Google, best-effort (`feat/agenda-google-renata`)** — OAuth da conta pessoal da Renata (scopes `calendar.readonly`+`calendar.events`, `access_type=offline&prompt=consent`; consent screen External precisa estar **In production** — em Testing o refresh token morre em 7 dias). Rotas `/api/google/oauth/{start,callback}` (owner-only, state anti-CSRF em cookie httpOnly; middleware isenta `/api/*` mas a rota valida sessão+role internamente). Tokens na tabela `google_accounts` (multi-conta ready; v1 usa a única ativa) — **nunca** selecionar colunas de token pra UI, nunca logar. Módulo `server/lib/google-calendar/` (fetch manual portado do JARVIS/ba-hub, zero deps novas): refresh transparente em `account.ts`, `invalid_grant` → `isActive=false` + admin mostra "reconectar". **CRM é fonte de verdade**: meeting grava primeiro, chamada Google é best-effort e devolve `googleSync` na action (`created/created_no_invite/updated/deleted/skipped_not_connected/failed`) — falha deixa a meeting sem `google_event_id` (badge "sem evento google" na timeline; recuperação = cancelar+reagendar; sem retry/cron by design). Agendar cria evento com convite pro email do lead + **Meet automático** (preenche `meetings.link` se vazio; `conferenceData.createRequest.requestId = crm-<meetingId>` determinístico); reagendar faz **PATCH no mesmo evento** e migra o vínculo pra nova linha de meeting; `cancelMeetingAction` (nova) deleta o evento (404/410 = sucesso). Duração fixa 60min (`event-payload.ts`). Description do evento é neutra (convidado enxerga) — rastreabilidade em `extendedProperties.private`. Agenda semanal exibida pelo client `RenataWeekAgenda` (`(crm)/_components/`) via `getGoogleWeekAgendaAction` (lazy, 1 chamada Google por semana navegada, offset 0..8): dentro do `ScheduleMeetingForm` aberto e na página `/calendario`. UI de reagendar/cancelar = `MeetingActions` na timeline (só `status='agendada'`). Envs: `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` (⚠️ pendentes no painel Vercel). Migration `0017_agenda_google_renata` (renumerada de 0016 no rebase pré-merge).
- **Evolução semanal do funil (dashboard)** — seção `WeeklyFunnelSection` com duas tabelas de **sempre 4 linhas = as 4 últimas semanas** de calendário (segunda→domingo, `America/Sao_Paulo`, a corrente marcada "em curso"): (1) **volume por etapa** (leads → formulário → qualificado → 1º contato → reunião agendada → realizada → proposta → venda; + `posts`/`alcance` como colunas "em manutenção" até Meta Ads/GA4) e (2) **conversão entre etapas** por **fluxo na semana** (throughput: `etapa_seguinte ÷ etapa_anterior` da MESMA semana, **não** coorte; denominador 0 → `—`, sem chute). Janelas em `server/lib/week-range` (`lastNWeeks`, `to` exclusivo) e matemática de conversão pura em `server/lib/week-range/conversion` (`weeklyConversions`). Dados via `getWeeklyFunnel()` em **3 queries agrupadas** (uma por fonte: leads / form_responses / lead_stage_history), com `count(*) FILTER (WHERE ...)` por semana usando os mesmos limites `[from, to)` do módulo `week-range`. **Nunca chamar `getCommercialFunnelCounts` por semana** (foi a 1ª tentativa): 4 semanas × ~8 queries = 32 round-trips; em paralelo esgotaram o pool de 10 conexões do `@repo/db/client` (`Connection closed`), em sequência estouraram o tempo da serverless function (`504 FUNCTION_INVOCATION_TIMEOUT`) — os dois são o mesmo sintoma de query demais, e **só reproduziram no deploy** (local a latência/contenção é menor). A versão agrupada dá números idênticos (verificado contra a por-semana) em 3 round-trips. `dashboard/page.tsx` tem `maxDuration=60` como folga defensiva. Fixo em 4 semanas — independe do `PeriodFilter` do funil. Volume ~4 leads/semana → números semanais são indicativos (ler tendência, não valor isolado).
- **Contrato de fechamento (.docx por mail-merge)** — gera um `.docx` de rascunho quando o lead está no estágio `paid`, na aba comercial do lead. **Separação-chave: texto ESTÁTICO do contrato vive no template `.docx`; conteúdo DINÂMICO é placeholder resolvido no código.** Template = Supabase Storage (bucket privado `contract-templates`, 1 por tipo de produto com contrato — `mentoria`/`assessoria`/`branding_pessoal`; infoproduto é self-serve, sem contrato), trocável por upload owner-only em `/admin/contratos` sem deploy. O `.docx` **nunca é persistido** — gerado on-demand a cada download (rota `app/api/leads/[leadId]/contrato/[contractId]`, `runtime nodejs`, primeira rota não-JSON do app), casando o template atual + snapshot de dados coletados salvo em `lead_contracts` (migration 0015, RLS). Merge via `docxtemplater`+`pizzip` (`server/lib/contract-docx`, `nullGetter → ''` — campo vazio nunca quebra). **Os templates canônicos são versionados** em `apps/crm/contract-templates/*.docx` + gerador `build.py` (python-docx; venv não commitado — `.gitignore`); `pnpm --filter crm upload-contract-templates` sobe pro Storage. Placeholders resolvidos no deep module puro `server/lib/contract-data-builder` (testado): **prazo** (default `PRAZO_DEFAULT` "6 (seis) meses", sobreponível — nunca vaza `[REVISAR]` pro documento); **pagamento** estruturado ÚNICO (`{tipo:'a_vista'|'parcelado'}` — total sempre de `leads.valorProposto`, parcela DERIVADA por `derivarParcelas(total,n)` = total÷n com resto de centavos na última → `base×(n-1)+last == total` sempre, fim do "665,67×3=1997,01"); **qualificação PF/PJ** do contratante ramificada por `isPessoaJuridica` (detecção pelo FORMATO — 14 dígitos = CNPJ; PF: RG+CPF+nacionalidade+profissão; PJ: razão social+CNPJ+sede+representante, sem "portador do RG" da empresa). Dinheiro em cents no cálculo; `valor-extenso` faz valor + cardinal por extenso. Dados fixos da CONTRATADA (Studio Sal LTDA — CNPJ/representante) vivem no template, **zero hard-code de cliente no core**. 2 testemunhas no bloco de assinatura (CPC 784 IV — slots em branco). Render tests de ponta a ponta em `server/lib/contract-docx/contract-render.test.ts` (renderiza os `.docx` commitados + builder → asserta texto). Branch `feat/contrato-fechamento`.
- **Grid semanal do dashboard (`WeeklyMetricsGrid`, sucessor da antiga `WeeklyFunnelSection`)** — transposto: **linhas = métricas, colunas = as 6 últimas semanas** de calendário (segunda→domingo, `America/Sao_Paulo`, a corrente marcada "em curso") lado a lado, leitura horizontal = evolução no tempo (referência: planilha do dono). Zona 1 = volumes crus (leads → formulário → qualificado → 1º contato → reunião agendada → realizada → proposta → venda; número puro + seta discreta `weekDelta` vs semana anterior). Zona 2 = as 6 conversões do `metric-registry` (fluxo na semana: `etapa_seguinte ÷ etapa_anterior` da MESMA semana, **não** coorte; denominador 0 → `—`) pintadas pelo semáforo de meta. Janelas em `server/lib/week-range` (`lastNWeeks`, `to` exclusivo); matemática pura em `server/lib/week-range/conversion` (`conversionPct`, `weeklyConversions`, `weekDelta`). Dados via `getWeeklyFunnel(6)` em **3 queries agrupadas** (uma por fonte: leads / form_responses / lead_stage_history), `count(*) FILTER (WHERE ...)` por semana. **Nunca chamar `getCommercialFunnelCounts` por semana** (1ª tentativa, abandonada): 4 semanas × ~8 queries = 32 round-trips estourava o pool/timeout na Vercel — a versão agrupada dá números idênticos em 3 round-trips. `dashboard/page.tsx` tem `maxDuration=60` como folga defensiva. Grid fixo em 6 semanas — **independe** do seletor de período do topo. Volume baixo (~4 leads/semana) → números semanais são indicativos, ler tendência.
- **Semáforo por meta editável no Admin (`metric_targets`) + período fechado no dashboard** — dashboard reformulado (2026-07) pra ser escaneável: catálogo de 9 métricas coloríveis vive em código (`server/lib/metric-registry`, chaves estáveis tipo `show_rate`/`conv_proposal_to_sale`/`ttfc_median_hours`); a **meta é dado**, gravada pelo owner em `/admin` → tabela `metric_targets` (comparador gte/lte + `threshold` + `yellow_margin`, upsert por `metric_key`). Avaliação em deep module puro `server/lib/metric-target-evaluator` (`evaluateMetric` → green/yellow/red/gray; `value` ou `target` ausente → **sempre gray, nunca colore no escuro**). Semáforo nunca é só cor: glifo ▲/●/▼ acompanha o valor, cores só dos tokens existentes (`leaf`/`wood`/`clay`/`ink-muted` — sem introduzir emerald/amber crus). Aplicado no KPI hero, no funil de vendas (`% avançam`) e no grid semanal. **Período do topo da página** (`server/lib/date-range`, `resolveDashboardPeriod`) trocou de janela móvel (`7d`/`30d`, removidas) para **períodos fechados de calendário** (`this_week` default/"em curso", `last_week`, `last_4_weeks`, `this_month`, `last_month`, `custom` via `?from=&to=`, `all`) — `this_week`/`last_4_weeks` reusam `lastNWeeks`. O período filtra o funil de vendas e o KPI hero; o grid semanal (6 semanas fixas) e o "funil por status"/"qualidade dos dados" (ambos snapshot "agora") **ignoram** o seletor de propósito. **KPI "conversão global" mudou de natureza**: era `pago/(pago+perdido)` snapshot, agora é `vendas ÷ leads entrados no período` (fluxo) — número não é comparável ao histórico pré-reforma. **Fix de bug herdado**: `getPipelineCounts` não selecionava `slug` — o KPI "não trabalhadas" filtrava por `stageDisplayName` (texto editável pelo owner, quebra se renomeado); corrigido pra filtrar por `stageSlug === 'application_received'` (padrão já usado em `getConversaoPorFonte`, removida nesta reforma). **Dashboard enxugado** nesta mesma leva: saíram volume por mês, fontes (donut), renda, orçamento, pontuação×engajamento, conversão por fonte, atividade recente, tempo médio por estágio (queries e o `DualAxisChart` deletados — git history preserva se precisar reverter).

---

## Aprendizados

- **Shell + route group `(crm)`**: comandos como `ls`, `find`, `cat` com `(crm)` no path falham em zsh — parênteses são interpretados como glob e retornam "no matches found" sem aviso útil. Sempre usar aspas duplas: `ls "apps/crm/src/app/(crm)/"` ou `find apps/crm/src/app -path "*crm*" -name page.tsx`.

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
