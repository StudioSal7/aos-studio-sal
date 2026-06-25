# CLAUDE.md — apps/crm

Contexto específico do app CRM. Ver também o [CLAUDE.md raiz](../../CLAUDE.md) para contexto do monorepo.

---

## Rotas

| Rota | Arquivo | Descrição |
|---|---|---|
| `/` | `app/page.tsx` | Redirect para `/kanban` |
| `/kanban` | `(crm)/kanban/page.tsx` | Pipeline Kanban |
| `/leads/[id]` | `(crm)/leads/[id]/page.tsx` | Detalhe do lead |
| `/busca` | `(crm)/busca/page.tsx` | Busca pg_trgm |
| `/quentes` | `(crm)/quentes/page.tsx` | next_action_at < 48h |
| `/revisao` | `(crm)/revisao/page.tsx` | needs_manual_review=true |
| `/calendario` | `(crm)/calendario/page.tsx` | Meetings da semana atual |
| `/dashboard` | `(crm)/dashboard/page.tsx` | Pipeline bruto + métricas |
| `/saude` | `(crm)/saude/page.tsx` | requires_attention=true |
| `/admin` | `(crm)/admin/page.tsx` | Owner only |
| `/admin/formularios` | `(crm)/admin/formularios/page.tsx` | Owner only — lista de formulários + criar |
| `/admin/formularios/[id]` | `(crm)/admin/formularios/[id]/page.tsx` | Owner only — editor (builder dnd + autosave) |
| `/admin/formularios/[id]/respostas` | `(crm)/admin/formularios/[id]/respostas/page.tsx` | Owner only — respostas + link p/ lead |
| `/f/[slug]` | `app/f/[slug]/page.tsx` | **Público** (fora do auth) — runtime do formulário |
| `/login` | `app/login/page.tsx` | Página de login |
| `/auth/callback` | `app/auth/callback/route.ts` | Supabase OAuth callback |
| `POST /api/webhooks/leads/respondi` | `app/api/webhooks/leads/respondi/route.ts` | Entrada de leads (Respondi) |
| `POST /api/forms/submit` | `app/api/forms/submit/route.ts` | **Público** — submit de formulário self-hosted → cria lead |
| `GET /api/crons/meeting-prompt` | `app/api/crons/meeting-prompt/route.ts` | */15 min |
| `GET /api/crons/sla-check` | `app/api/crons/sla-check/route.ts` | Diário 11h UTC (8h SP) |
| `GET /api/crons/data-quality` | `app/api/crons/data-quality/route.ts` | Segunda 11h UTC (8h SP) |

---

## Server Actions

| Arquivo | Actions |
|---|---|
| `server/actions/leads.ts` | `updateLeadStageAction`, `assignResponsavelAction`, `updateLeadFieldsAction`, `softDeleteLeadAction` |
| `server/actions/meetings.ts` | `scheduleMeetingAction`, `rescheduleMeetingAction`, `completeMeetingAction` |
| `server/actions/users.ts` | `inviteUserAction` |
| `server/actions/search.ts` | `searchLeadsForPalette(query)` — reusa `searchLeads` do query builder; usado pelo Cmd+K |
| `server/actions/forms.ts` | **owner-only** — `createFormAction`, `updateFormAction`, `deleteFormAction`, `duplicateFormAction`, `addFieldAction`, `updateFieldAction`, `deleteFieldAction`, `reorderFieldsAction` |

---

## Deep modules (testáveis isoladamente)

| Módulo | Tipo | Testes |
|---|---|---|
| `server/lib/whatsapp-normalizer/` | Puro | 24 passando |
| `server/lib/respondi-payload-mapper/` | Puro | 29 passando |
| `server/lib/form-answer-mapper/` | Puro | 14 passando |
| `server/lib/lead-intake/` | Usa DB | Sem testes (compartilhado: form submit; webhook Respondi segue inline) |
| `server/lib/stage-transition-validator/` | Puro | 8 passando |
| `server/lib/legacy-csv-parser/` | Puro + fixtures | 32 passando |
| `server/lib/dedup-matcher/` | Integração DB | 8 (skip sem DATABASE_URL) |
| `server/lib/search-query-builder/` | Puro | Sem testes dedicados |
| `server/audit-writer.ts` | Usa DB | Sem testes dedicados |

---

## ⚠️ Arquivo que precisa de ação antes do go-live

**`src/lib/respondi-mapping.ts`** — hoje tem placeholders:
```ts
q_name: 'name',     // ← substituir por ID real do Respondi
q_email: 'email',   // ← substituir por ID real do Respondi
// ...
```

Para obter os IDs reais:
1. Abrir painel Respondi → Integrações → Webhook → **Testar** (artigo 96 do help)
2. Submeter um formulário de teste
3. No payload retornado, cada pergunta tem `"id": "abc123..."` — copiar esses IDs
4. Substituir os placeholders `q_*` pelos IDs reais

---

## Componentes novos (Fase 1.5)

| Componente | Tipo | Descrição |
|---|---|---|
| `components/command-palette/index.tsx` | Client | Cmd+K palette: busca leads, navega, cria, ações no lead atual |
| `components/ui/action-feedback.tsx` | Client | Feedback padronizado: idle → pending → success (2.5s) → error |
| `components/ui/kbd-hint.tsx` | Server | `<KbdHint keys={['shift','m']} />` — exibe atalho de teclado ao lado de CTAs |
| `app/(crm)/leads/[id]/_components/lead-detail-tabs.tsx` | Client | Tabs com URL state real (`?tab=` via `useSearchParams`/`router.replace`) — default `atividade`. Effect best-effort de scroll p/ `#resp-<id>` quando cai na aba `info` |
| `app/(crm)/leads/[id]/_components/activity-timeline.tsx` | Server | Timeline cronológica reversa: reuniões + mudanças de estágio + **formulários preenchidos** (evento clicável → `?tab=info#resp-<id>`) |
| `app/(crm)/leads/[id]/_components/lead-dossier.tsx` | Server | **Dossiê** (aba "informações"): identificação + qualificação (labels legíveis) + origem + dados extraídos das calls + respostas verbatim de todos os formulários (`<details>` nativo). Só leitura |
| `app/(crm)/leads/[id]/_components/data-row.tsx` | Server | `Section` + `DataRow` extraídos (reusados no dossiê e na aba comercial) |
| `app/(crm)/_components/lead-quick-view.tsx` | Client | Sheet lateral (~480px) ao clicar no card do Kanban |

**Primitivos UI adicionados ao shadcn:** `sheet.tsx`, `tabs.tsx`, `command.tsx`

**Formulários — componentes relevantes:**

| Arquivo | Descrição |
|---|---|
| `components/forms/form-runtime.tsx` | Runtime público (Typeform-style). Suporta `config.backgroundImage`: aplica `background-image` inline + overlay `bg-black/45` + classe `.form-on-photo` que sobrescreve tokens CSS para versão branca/transparente. **Auto-submit ao chegar na tela `encerramento`** (`useEffect` guardado por `useRef`) — a tela "recebemos sua aplicação" não tem botão de envio, então o POST dispara sozinho; `ClosingSending`/`ClosingError` dão feedback honesto (enviando → sucesso → retry em falha) |
| `components/forms/fields.tsx` | 13 tipos de campo. `WelcomeField` usa `bg-wood` nos botões (não `bg-ink`) + `whitespace-pre-line` no subtítulo para `\n` literais |
| `app/globals.css` | Classe `.form-on-photo` — override de todos os tokens semânticos (`--color-ink`, `--color-paper`, `--color-line`, etc.) para fundos escuros. Tailwind herda automaticamente via CSS custom property cascade |
| `scripts/seed-aplicacao-sal.ts` | Cria form `aplicacao-sal` (17 telas, réplica do Respondi, fundo `/sal-fundo.jpg`). Idempotente. `pnpm --filter crm seed-aplicacao-sal` |
| `public/sal-fundo.jpg` | Foto botânica escura (folhas tropicais) — fundo do form `aplicacao-sal` |

---

## Convenções deste app

- Datas: sempre `timestamptz` no banco (UTC). Exibir com `toLocaleString(..., { timeZone: 'America/Sao_Paulo' })` ou `toZonedTime` do `date-fns-tz`
- Input `datetime-local` não tem TZ → sempre converter com `fromZonedTime(input, 'America/Sao_Paulo')` antes de salvar
- Imports de schema: usar `@repo/db/schema` (não `@repo/db`) em módulos que rodam em testes sem banco
- `requireAuth()` em todo Server Action e route handler autenticado
- `revalidatePath('/')` após mutations no Kanban; `revalidatePath('/leads/[id]')` após mutations em lead detail
