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

## Schema (20 tabelas)

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
| `sal_sales` | Vendas Sal (owner only) |
| `commercial_analyses` | Análises CallScore (closer/sdr) — `score_breakdown`/`extracted_data` jsonb |
| `roleplay_scenarios` | Cenários de treino SPIN (persona/contexto/objeções do lead simulado) |
| `roleplay_sessions` | Sessões de treino — `overall_score` (CHECK 0–100), `score_breakdown`/`feedback` jsonb |
| `roleplay_messages` | Mensagens da sessão (append-only) — `role` prospect/closer/system, `turn_index` |
| `forms` | Formulários self-hosted (substituem o Respondi) — `slug` único, `status` rascunho/ativo/pausado/encerrado, `config` jsonb (tema/redirect/UTM/**backgroundImage**) |
| `form_fields` | Campos do formulário — 13 tipos, `ordem`, `config` jsonb, **`lead_mapping`** (coluna do lead) + **`lead_enum_map`** jsonb (opção→literal de enum) |
| `form_responses` | Respostas cruas (auditoria) — `dados` jsonb, `lead_id` FK (set null), `metadata` UTM |

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
- TypeScript: 0 erros (`tsc --noEmit`)
- Testes: 166 passando, 8 skipped (dedup integração), 0 falhas (14 novos: `form-answer-mapper`)

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
