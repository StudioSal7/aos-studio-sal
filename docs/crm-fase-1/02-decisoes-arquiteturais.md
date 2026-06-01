---
name: CRM Fase 1 — decisões arquiteturais travadas no grilling
description: Decisões técnicas e de produto fechadas durante sessão de grill-me; usar como base para schema, UI e implementação
type: project
originSessionId: 84bf1eda-8a11-4856-9aaa-6b5317039820
---
Decisões fechadas em sessão de grill-me (24 perguntas resolvidas — 18 originais + 6 adicionais sobre stack/auth/timezone/cron/notificações/seeds). Cada uma carrega trade-offs explícitos.

**Estágios (slugs imutáveis, display_name + position editáveis pela cliente):**
`application_received, under_review, qualified, first_contact_sent, meeting_scheduled, meeting_done, proposal_sent, closed_verbally, contract_sent, paid, lost`. Tabela `lead_stages` com `slug` (immutable) + `display_name` + `position` + `kind` (`open|won|lost`). SEM `deleted_at` em `lead_stages` nem em catálogos/logs.

**Score:** matar score numérico 0-100. Mostrar flags visuais (✓ ICP renda, ✓ ICP idade, ✓ ICP orçamento, etc.). ICP hardcoded com `// TODO Fase 2: configurável`. Quentes ordena por `next_action_at ASC NULLS LAST, stage.position DESC`.

**Dashboard:** pipeline aberto bruto + contagens por estágio + tempo médio por estágio. SEM projeção ponderada por histórico. Projeção entra na Fase 2 quando tiver ≥20 fechamentos por estágio.

**Identidade & dedup:** chave = email OU whatsapp normalizado E.164. Webhook duplicado faz upsert + notifica responsável + registra no `lead_intake_log`. Legado marca dups (não merge auto), cliente decide consolidação.

**Schema-chave:**
- `leads`: identifição + qualificação (incluindo 3 enums extras descobertos no CSV: `idade_faixa`, `abordagem_preferida`, `tempo_no_nicho_faixa`), `whatsapp_e164` + coluna gerada `whatsapp_digits_only`, `instagram_handle` normalizado, `sdr_id` + `closer_id` (separados, ambos nullable), `next_action_at/type/notes`, `needs_manual_review` + `manual_review_reason`, `marcado_fake`, soft delete via `deleted_at`. Notas em **plain text** (sem rich editor na Fase 1).
- `lead_stages`, `lead_loss_reasons`, `lead_objections`, `lead_sources`: catálogos sem soft delete.
- `lead_stage_history` (específica): registra cada mudança de estágio com previous/new + tempo no estágio anterior.
- `lead_field_audit` (genérica, append-only): `lead_id, field_name, old_value, new_value, changed_by, changed_at, request_id`. Audita só subset crítico (sdr_id, closer_id, valor_proposto, motivo_perda_id, marcado_fake, deleted_at). Não audita notas, instagram, telefone.
- `lead_action_log` (append-only): histórico de mudanças em `next_action_*`.
- `lead_intake_log` (append-only): toda submissão webhook/import.
- `meetings`: `scheduled_at, link, status (agendada|realizada|nao_realizada|reagendada|cancelada), notes_post_call`. Reagendamento = soft-cancel + nova row (não update in-place).
- `users`: role enum `owner | sdr | closer`.

**Audit trail:** app-side em Server Actions (não triggers PostgreSQL). Helper Drizzle escreve audit + mutação na mesma transaction.

**RLS:** todos veem tudo (Cenário 1, 3 papéis máx). Só owner deleta e edita catálogos. Diferença de papel é foco de UI, não parede de visibilidade.

**Entrada de leads:**
- Webhook único `/api/webhooks/leads/respondi?token=...` (token via query string — Respondi não suporta headers customizados)
- Idempotência via `respondent.respondent_id` (UUID que Respondi envia no payload)
- Mapping de campos do payload Respondi via `raw_answers[].question.question_id` (estável; NÃO usar `question_title` que cliente pode editar)
- `respondent.date` vem sem TZ ("YYYY-MM-DD HH:MM") — interpretar como `OPERATION_TZ` (SP)
- Provavelmente só dispara em `respondent.status='completed'` (a confirmar nos primeiros testes)
- UTMs vêm separados em `respondent.respondent_utms.*` — mapeia direto pra `lead.utm_*`
- Form nativo NÃO está na Fase 1 (vem via Respondi.app)
- Sem CAPTCHA, sem honeypot

**Reuniões:** scheduled_at digitado manualmente na Fase 1 (sem Calendly/GCal). Prompt automático 30min após scheduled_at vai pro `closer_id` ("a call aconteceu? sim/reagendar/perdido"). Cron Vercel.

**Drag-and-drop:** optimistic update com rollback em erro. Validação rígida só em transições pra `lost` (motivo) e `paid` (valor + forma_pagamento). Any-to-any (operação tem pulos legítimos: paga na call → vai direto pra Pago). Sem Realtime sync na Fase 1.

**Busca:** pg_trgm GIN em 5 campos (`name, nickname, email, instagram_handle, whatsapp_digits_only`). Prefix match pra <3 chars, fuzzy ≥3. Limite 20 + filtro lateral por estágio. Notas FORA da busca na Fase 1.

**Import legado (~200 leads do CSV em planilha):**
- Script TypeScript local (`pnpm tsx scripts/import-legacy.ts`), não endpoint público
- Relatório de qualidade obrigatório (importados / dups / falhas)
- Mapping: FAKE → `lost` com motivo `fake_spam`. `aguardar produto`/`aguardar mentoria`/`contato salvo` (~51 leads) → `under_review` + `needs_manual_review=true` ("legado: closer não atualizou status, validar antes de avançar")
- Adiciona 7ª view "Para revisão" — zerar a fila pelo menos uma vez é critério de pronto da Fase 1

**Fechado verbalmente é OPCIONAL/PULÁVEL:** cliente que paga na call vai direto pra Pago. Sem dialog forçando passagem. SLA hardcoded de 24h NÃO entra na Fase 1 — vira configurável quando tiver dado.

**Próxima ação:** campo único no lead (`next_action_at/type/notes`) + log append-only `lead_action_log` que registra cada mudança. Quando vendedor edita ação sem concluir, marca anterior como `completion_kind='replaced'`.

---

## Decisões adicionais (Perguntas 19-24)

**Stack do monorepo Turborepo (P19):**
- App separado pro CRM: `apps/crm` (não dentro de app maior). Permite deploy independente, env vars isoladas, domínio próprio (`crm.cliente.com.br`).
- 3 packages compartilhados: `packages/db` (Drizzle schema + queries puras), `packages/ui` (shadcn/ui + design system), `packages/config` (eslint/tsconfig/tailwind/prettier).
- Server Actions vivem em `apps/crm/src/server/actions/`, importam queries puras de `@repo/db`.
- Migrations via Drizzle Kit: `pnpm db:generate` cria SQL, revisão manual, `pnpm db:migrate` aplica em prod. `pnpm db:push` em dev pra iterar rápido.

**Auth (P20):**
- Provider: Supabase Auth nativo
- Login: email + senha (não magic link). Forgot password padrão.
- Criação: invite-only por owner via `/admin/users`. Owner digita email + role → `auth.admin.inviteUserByEmail()` → user define senha no primeiro acesso.
- Role armazenada na tabela `users` do Drizzle (não em auth metadata): `role enum('owner','sdr','closer')` + `pending_invite bool`.
- Enforcement: app-level via Server Actions. Helper `requireAuth()` retorna `{ userId, role, email }`. DB connection usa service role (bypass RLS DB). RLS DB-level apenas como rede de segurança (`anon` denied de tudo).

**Timezone (P21):**
- Storage: `timestamptz` em todas as colunas de data
- TZ da operação: **America/Sao_Paulo** (constante `OPERATION_TZ`)
- Tudo (cron, display, lógica de "X horas em estágio") usa SP. Sem campo `lead_timezone`. Leads internacionais e closers se alinham.
- Input de data/hora na UI sempre em BRT.

**Cron infra (P22):**
- Vercel Cron (plano Pro). Confirmar que cliente está em Pro antes de codar; senão fallback Supabase pg_cron.
- 3 crons na Fase 1:
  - `meeting-prompt`: a cada 15min (encontra meetings com `scheduled_at + 30min < now()` e `status='agendada'`, marca `meetings.needs_confirmation=true`)
  - `sla-check`: 1x/dia (encontra leads violando regras de SLA configuradas; marca `leads.requires_attention=true` + razão; idle se nenhum SLA configurado)
  - `data-quality`: 1x/semana (segunda 8h SP — leads sem responsável há 7+ dias, leads em "Aplicação recebida" há 30+ dias, etc.; output em view "Saúde dos dados")
- Auth: `CRON_SECRET` em env, header `Authorization: Bearer ${secret}` validado em todo route handler de cron.

**Notificações (P23) — DEFERIDAS PRA FASE 2:**
- Sem tabela `notifications` na Fase 1
- Sem polling de 60s
- Sem push de qualquer tipo (in-app, email, SMS)
- "Como cliente fica sabendo de coisas" passa a ser **pull**: badges nos cards do Kanban + views específicas (Quentes, Para revisão, Pós-venda travado, Saúde dos dados). Cliente abre CRM e vê.
- Coerente com cliente sozinha + baixo volume.

**Seeds dos catálogos + enums de venda (P24):**
- `lead_loss_reasons`: seedo 11 motivos (`qualificacao_reprovada, lead_silenciou, fake_spam, lista_de_espera_vencida, preco_alto, timing_ruim, sem_fit_pessoal, escolheu_concorrente, sumiu_apos_proposta, decisao_adiada, outro`). Cliente edita via admin.
- `lead_objections`: vazio inicialmente. Cliente preenche via admin durante onboarding (textbox grande explicando o que é).
- `lead_sources`: seedo 5 do CSV legado (`giu_salvatore_indicacao, instagram_organico, indicacao_pessoal, tiktok, podcast`) + opção `outro` que abre campo de texto. Webhook do Respondi mapeia string → slug.
- `forma_pagamento_negociada` no lead: **texto livre com autocomplete** baseado em valores anteriores. Sem enum rígido. Heurística simples (`LIKE 'à vista%'`) pra dashboard quando precisar.
- Produto de interesse: **catálogo `products`** com `slug, display_name, ticket_min, ticket_max, kind, active`. Cliente cria produtos com nomes próprios via admin no onboarding (ex: "Mentoria Salto", "Consultoria Voo"). Lead tem `produto_interesse_id` FK. Score Fase 2 vai usar `lead.orcamento >= product.ticket_min`.
