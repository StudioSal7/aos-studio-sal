# PRD — Melhorias de UX/layout + Funil de Vendas comercial (Studio SAL CRM)

> Data: 2026-07-13 · Autor: Opus (planejamento) · Executor: outro modelo · Auditoria: agente-auditor ao final
> Branch: `feat/melhorias-crm-funil-comercial` · Entrega alvo: **hoje até 16h**
>
> Este PRD segue o template `to-prd` (Matt Pocock), não o agente-planejador.
> A integração ao vivo de **Meta/Facebook Ads, Hotmart (webhook) e GA4/Clarity**
> ("Métricas Financeiras") está **fora de escopo** — fase posterior (ver seção
> _Out of Scope_).

---

## Problem Statement

O owner (Giulia/Rodrigo) e o time usam o CRM diariamente, e há uma apresentação
do sistema **hoje**. Hoje existem:

- **Bugs visuais** que quebram a percepção de produto acabado: valores de KPI
  vazando das caixas conforme o zoom, cards que não se ajustam, a sidebar que
  rola a página inteira (com barra preta e espaços em branco), e menus que abrem/
  fecham "no susto", sem transição — chegando a disparar um erro no console.
- **Fricção no dossiê do lead**: abrir um lead cai numa aba que não é a de
  informações; nem toda resposta de formulário aparece ali; e e-mail, WhatsApp e
  Instagram são texto morto (não dá pra acionar contato num clique).
- **Funil comercial incompleto**: o dashboard só mostra "todo o período" (sem
  recortes de tempo) e não existe um **funil de vendas** de ponta a ponta (de
  posts até venda) com SLA e follow-up. Parte dessas métricas o sistema já
  coleta; outra parte depende de integrações que virão depois — mas na
  apresentação de hoje o funil precisa **aparecer inteiro**, com o que falta
  claramente sinalizado como "em manutenção".
- **Alertas de segurança do Supabase**: RLS desabilitada em todas as tabelas
  públicas (21 erros), precisa ser corrigida.

## Solution

Do ponto de vista do usuário:

1. **A interface para de "quebrar"**: cards se ajustam ao conteúdo em qualquer
   zoom; a sidebar rola sozinha (sem arrastar a página nem barra preta); e os
   grupos do menu abrem/fecham com uma animação suave. O erro de console some.
2. **O dossiê do lead vira central de ação**: clicar em "abrir detalhe completo"
   leva direto para **informações**; toda pergunta respondida no formulário
   aparece ali; e e-mail, WhatsApp e Instagram são **clicáveis** (abrem o cliente
   de e-mail, a conversa no WhatsApp e o perfil no Instagram).
3. **O funil comercial ganha tempo e profundidade**: um seletor de período
   (**7 dias — padrão**, 30 dias, este mês, mês passado, todo o período) filtra as
   métricas; e um **funil de vendas** completo é exibido. As etapas que o sistema
   já mede aparecem com números reais; as que dependem de integração futura
   aparecem no mesmo layout com uma **tag vermelha "em manutenção"**. Follow-up e
   SLA seguem a mesma lógica de período.
4. **O banco fica seguro**: RLS habilitada em todas as tabelas públicas (o app
   segue funcionando porque acessa via `service_role`/conexão direta, que ignora
   RLS).

---

## User Stories

### Bugs de layout / UX

1. Como usuário do CRM, quero que os valores dos cards de KPI (investimento,
   receita, CPA, ROAS etc.) fiquem **dentro** da caixa em qualquer nível de zoom,
   para que o dashboard nunca pareça quebrado.
2. Como usuário, quero que o tamanho da caixa do card se ajuste ao conteúdo
   (e não o contrário), para que números grandes não vazem.
3. Como usuário, quero que os cards/caixas de texto da seção "por campanha" e da
   tabela de campanhas também se ajustem ao zoom, pelos mesmos motivos.
4. Como usuário, quero que a **sidebar role internamente** quando o menu é maior
   que a tela, para que eu não role a página inteira sem querer.
5. Como usuário, quero que **não apareça a barra de rolagem preta** na lateral
   direita nem espaços em branco nas seções, consequência de conter o scroll na
   sidebar.
6. Como usuário, quero que ao clicar em "CRM", "Comercial" ou "Marketing" o grupo
   **abra e feche com animação fluida** (não instantânea), para uma sensação mais
   leve e polida.
7. Como usuário, quero que o **erro de console** (404 de recurso + "Connection
   closed") deixe de acontecer na navegação normal.

### Dossiê do lead

8. Como usuário, quero que **"abrir detalhe completo"** no quick view do lead me
   leve direto para a aba **informações**, para já cair no dossiê.
9. Como usuário, quero que **todas as respostas do formulário** que o lead
   preencheu apareçam na aba informações (inclusive perguntas não mapeadas para
   colunas, como "quais desses desafios..." e "qual dessas abordagens..."), para
   ter o retrato completo do lead num lugar só.
10. Como usuário, quero clicar no **e-mail** do lead e abrir meu cliente de
    e-mail já endereçado para ele.
11. Como usuário, quero clicar no **WhatsApp** do lead (número continua visível)
    e abrir a conversa direta no WhatsApp.
12. Como usuário, quero clicar no **@ do Instagram** do lead e abrir o perfil dele
    no Instagram.
13. Como usuário, quero que esses contatos sejam clicáveis tanto no **cabeçalho**
    do lead quanto no **dossiê** (aba informações).

### Atividade recente

14. Como usuário, quero que "atividade recente" mostre **no máximo ~5 itens
    visíveis** com **scroll interno**, para que a lista não estique a página
    infinitamente quando houver muitos leads.

### Funil comercial — período

15. Como usuário, quero um **seletor de período** com as opções _7 dias, 30 dias,
    este mês, mês passado, todo o período_, para analisar recortes de tempo.
16. Como usuário, quero que o padrão ao abrir seja **7 dias**, por ser o recorte
    mais acionável no dia a dia.
17. Como usuário, quero que o período escolhido **filtre todas as métricas
    cabíveis** (leads que entraram, funil de vendas, SLA, follow-up), de forma
    consistente.
18. Como usuário, quero que o período fique **na URL** (compartilhável e
    persistente ao recarregar).
18b. Como usuário, quero que o **seletor de período seja discreto**: por padrão
    mostra só a opção ativa (ex.: "7 dias"), e ao clicar **expande** as demais
    opções para eu escolher — em **todas as seções onde existe filtro de
    período** (dashboard, funil de vendas, vendas SAL), não uma fileira de chips
    sempre visível.

### Funil de vendas (ponta a ponta)

19. Como usuário, quero ver um **funil de vendas** com as etapas: _posts feitos →
    visualizações geradas → formulários enviados → reuniões agendadas → reuniões
    comparecidas → propostas realizadas → vendas feitas_.
20. Como usuário, quero que as etapas **já coletadas** (formulários enviados,
    reuniões agendadas, reuniões comparecidas, propostas realizadas, vendas
    feitas) mostrem **números reais** filtrados pelo período.
21. Como usuário, quero que as etapas ainda **não coletadas** (posts feitos,
    visualizações geradas) apareçam **no mesmo layout** com uma **tag vermelha
    "em manutenção"** no lugar do número, para que o funil pareça completo na
    apresentação e eu saiba o que ainda falta.
22. Como owner, quero uma **lista de pendências** clara (o que está "em
    manutenção" e por quê) para resolver depois.

### Follow-up e SLA

23. Como usuário, quero ver **quantidade de follow-ups por lead**; enquanto a
    fonte de dados de mensagens não existe, quero que essa métrica apareça com a
    tag **"em manutenção"** (não com número falso).
24. Como usuário, quero o **SLA (tempo de primeiro atendimento) médio** por
    período (7d/30d/este mês/mês passado/todo o período), reusando o cálculo de
    "tempo até 1º contato" que já existe.
24b. Como usuário, quero que esse card use um **rótulo por extenso** (ex.:
    "tempo médio de primeiro atendimento") em vez da sigla técnica "SLA", para
    não exigir conhecimento de jargão.

### Segurança (Supabase)

25. Como owner, quero **RLS habilitada** em todas as tabelas públicas para
    eliminar os 21 erros do linter, sem quebrar o app.
26. Como owner, quero receber o **SQL em texto** para aplicar as correções, além
    da migração versionada no repo.

---

## Implementation Decisions

### Módulos novos / alterados (sem caminhos de arquivo fixos — o executor confirma)

**Puros (deep modules) — alta testabilidade, prior art `first-contact-metric`:**

- **`date-range`** (novo, puro): resolve um recorte de período em `{ from, to }`.
  Vocabulário canônico: `'7d' | '30d' | 'this_month' | 'last_month' | 'all'`.
  `7d`/`30d` = últimos N dias (rolling); `this_month`/`last_month` = mês
  calendário em `America/Sao_Paulo`; `all` = sem limite. Padrão `'7d'`.
  Generaliza o `SalesRange` que já existe em `sal-sales.ts` (que hoje é
  `'7d'|'30d'|'90d'|'all'`). Unificar o vocabulário; `vendas-sal` pode migrar
  para este módulo (ou permanecer, alinhado depois — não bloqueia).
- **`contact-links`** (novo, puro): monta URLs de contato a partir dos dados do
  lead. `mailto:<email>`; `https://wa.me/<digits>` (só dígitos, remove `+` e não
  dígitos — prior art `whatsapp-normalizer`); `https://instagram.com/<handle>`
  (remove `@`). Retorna `null` quando o dado não existe.

**Server queries (agregação):**

- **Funil de vendas** (novo em `server/queries/`, provavelmente `commercial-funnel.ts`):
  agrega, por período, as etapas coletadas:
  - _formulários enviados_ = `count(form_responses)` com `parcial=false` no range
    (por `concluido_em`).
  - _reuniões agendadas_ = `count(meetings)` com `status in ('agendada',
    'realizada','reagendada')` no range (por `scheduled_at`) — ou leads que
    atingiram o estágio `meeting_scheduled` no range via `lead_stage_history`.
    **Decisão**: usar `meetings` (fonte primária do evento).
  - _reuniões comparecidas_ = `count(meetings)` com `status='realizada'` no range.
  - _propostas realizadas_ = leads que atingiram o estágio `proposal_sent` no
    range, via `lead_stage_history.changed_at`.
  - _vendas feitas_ = leads que atingiram o estágio `paid` (kind `won`) no range,
    via `lead_stage_history`. (A conciliação financeira com `sal_sales`/Hotmart é
    fase posterior; o funil é lead-based.)
  - _posts feitos_ e _visualizações geradas_ = **não coletadas** → retornam
    marcador `emManutencao` (sem número).
- **SLA médio por período**: estender `getTimeToFirstContact`/
  `computeFirstContactMetric` para aceitar o range (filtrar por
  `application_received_at` no período). Reusa o cálculo existente (mediana +
  % dentro de 24h).
- **Leads que entraram no período**: contagem de leads por data de entrada no CRM
  no range. Usar `application_received_at` quando disponível; fallback
  `created_at` para legados. (Executor confirma o campo de entrada mais robusto.)

**Filtro de período (UI):**

- **Seletor de período discreto (`PeriodFilter`)** — componente client
  compartilhado, usado em **toda seção com filtro de período** (dashboard, funil
  de vendas, e a página `vendas-sal` migra para o mesmo componente no lugar da
  fileira de chips sempre visível que tem hoje). Estado fechado: mostra **só a
  opção ativa** como um chip discreto (ex.: `7 dias ⌄`). Ao clicar, **expande**
  inline as demais opções (`30 dias`, `este mês`, `mês passado`, `todo o
  período`); ao escolher uma, atualiza `?range=...` na URL e recolhe. Implementar
  com `<details>/<summary>` nativo (sem lib nova, sem necessidade de detectar
  clique-fora) estilizado com os tokens do design system. Dirigido por
  **`searchParams`** lido no Server Component pai — o próprio filtro só navega.
  Default `'7d'`.

**Funil de vendas (UI) — especificação visual, com os ajustes do André de 13/07:**

Nova seção **"funil de vendas."** no dashboard (logo abaixo do KPI hero — bloco
de maior destaque da apresentação). Mockup inicial aprovado, com 5 ajustes
posteriores incorporados (não regenerar o mockup — seguir a descrição abaixo):

- **Cabeçalho no padrão do resto do app**: título `funil de vendas.` (Gowun
  Batang, lowercase) alinhado à esquerda, **`PeriodFilter` discreto** alinhado à
  direita na mesma linha, e uma **divisória horizontal** (`border-b border-line`)
  logo abaixo do título separando cabeçalho do conteúdo — mesmo padrão do
  `PageHeader` (título em cima, linha divisória, conteúdo abaixo), replicado
  aqui dentro da seção. **Sem subtítulo** ("da atração à venda..." foi removido
  — redundante com o título).
- **Funil = lista vertical de etapas** (barras horizontais decrescentes, não
  pirâmide). Cada linha: **label à direita-alinhada** (~150px), **trilho da
  barra** (`bg-canvas`, altura ~34px, sem radius) com a **barra preenchida**
  proporcional ao valor, e o **valor à direita** (Gowun Batang ~19px).
- **Cores das barras**: etapas coletadas em **marrom** (`wood`); a etapa final
  "vendas feitas" em **verde-folha** (`leaf`) para destacar a conversão; etapas
  em manutenção com **barra hachurada** + **tag vermelha "em manutenção"** no
  lugar do número (mesma cor/linguagem do badge `fake` já existente, token
  `clay`). **Sem legenda de rodapé** ("coletada · venda · em manutenção" foi
  removida — a tag vermelha já é autoexplicativa por si só).
- **Taxa de conversão entre etapas coletadas**: micro-linha `↓ NN% avançam`
  abaixo de cada etapa (`ink-muted`).
- **Ordem das etapas**: posts feitos → visualizações geradas → formulários
  enviados → reuniões agendadas → reuniões comparecidas → propostas realizadas →
  vendas feitas. As 2 primeiras com a tag "em manutenção" para o funil **parecer
  completo** na apresentação.
- **Dois mini-cards** abaixo do funil, lado a lado (mesmo padrão dos KPI cards):
  - **"tempo médio de primeiro atendimento"** — rótulo **por extenso**, nunca a
    sigla "SLA" (evitar jargão técnico). Valor real: mediana + % dentro de 24h,
    filtrado pelo período.
  - **"quantidade de follow-up por lead"** — valor `—` + tag vermelha "em
    manutenção" (aguarda base de mensagens).
- **Responsividade/anti-bug**: todas as caixas e o trilho usam `min-w-0
  overflow-hidden` e `minmax(0,1fr)` nas grids, para não repetir o overflow dos
  KPI cards em zoom.

Referência textual do layout final (após os 5 ajustes — não é mais o mockup
visual original, que tinha legenda/subtítulo/chips sempre visíveis):

```
funil de vendas.                                         [7 dias ⌄]
──────────────────────────────────────────────────────────────────
        posts feitos  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  [em manutenção]
 visualizações ger.  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  [em manutenção]
formulários envi...  ███████████████████        48
                     ↓ 46% avançam
reuniões agendadas   █████████████              22
                     ↓ 68% avançam
reuniões compare...  ██████████                 15
                     ↓ 60% avançam
propostas realiz...  ███████                     9
                     ↓ 44% avançam
      vendas feitas  ████ (verde)                4

[ tempo médio de primeiro atendimento   2d ]   [ quantidade de follow-up por lead   —  em manutenção ]
```

### Correções de layout (decisões concretas)

- **Overflow dos KPI cards**: a `Card` do card de KPI recebe `min-w-0
  overflow-hidden`; o container em grid recebe `min-w-0` nas colunas; o valor
  passa de `text-[32px]` fixo para **fonte fluida** (`clamp(...)` ou passo
  responsivo) + `break-words`, para caber em qualquer largura/zoom. Aplicar tanto
  no `trafego` quanto em qualquer card com valor grande. (O `KpiCard` do dashboard
  já tem `min-w-0 overflow-hidden break-words`; alinhar o do `trafego` ao mesmo
  padrão.)
- **Sidebar/scroll**: no layout do `(crm)`, a raiz `flex h-screen` recebe
  `overflow-hidden`; o `<nav>` passa a `flex-1 min-h-0 overflow-y-auto` (rola
  internamente). Isso elimina o scroll da página inteira, a barra preta e os
  espaços em branco.
- **Animação do grupo colapsável**: substituir `{open && children}` por um
  container animado. **Decisão**: usar o truque CSS de `grid-template-rows: 0fr →
  1fr` com `transition` (sem dependência nova, suave), envolvendo os itens em
  `overflow-hidden`. Alternativa aceitável: `framer-motion` se já estiver no bundle
  do app (confirmar; preferir CSS puro). O chevron já tem transição — manter.
- **Atividade recente**: buscar até ~20 itens (`getRecentActivity(20)`), mas
  renderizar dentro de um container com **altura ≈ 5 linhas** + `overflow-y-auto`.
- **Erro de console (404 + "Connection closed")**: investigar ao vivo. Hipótese
  principal: "Connection closed" é abort de streaming RSC do Next (navegação/ação
  interrompida) e o 404 é chunk `5159-*.js` obsoleto pós-deploy (hash de chunk
  antigo no cliente). Ação: reproduzir; confirmar se a correção do layout/colapso
  remove o disparo por interação; se for stale-chunk pós-deploy, é benigno.
  Critério de aceite: **sem erros no console** em carga limpa + navegação dentro
  de um mesmo deploy.

### Remoções / ajustes pontuais

- Remover a linha **"⌘K para buscar"** do rodapé da sidebar (o command palette
  Cmd+K **continua funcionando** — remove-se só o texto/hint).
- **"abrir detalhe completo"** no quick view passa a linkar
  `/leads/<id>?tab=info` (a aba `info` já é suportada via `searchParams`).
- **Contatos clicáveis** no cabeçalho do lead e no dossiê: e-mail (`mailto:`),
  WhatsApp (`wa.me/<digits>`), Instagram (`instagram.com/<handle>`), abrindo em
  nova aba quando externo (`target="_blank" rel="noopener noreferrer"`).

### Schema / SQL

- **RLS**: migração nova habilitando RLS nas 21 tabelas públicas (deny-all, sem
  policies permissivas — o app usa `service_role`/conexão direta que ignora RLS,
  conforme arquitetura "anon negado"). Gerar como migração Drizzle **e** entregar
  o SQL em texto ao André (ver _Further Notes_). Isso também resolve o
  `sensitive_columns_exposed` de `roleplay_messages` (mesma correção).
- **Warnings (não bloqueantes, tratados à parte)**: `pg_trgm` em `public` (mover
  de schema é arriscado por causa dos índices trigram — deixar como pendência
  opcional) e "leaked password protection" (é _toggle_ no painel Auth do Supabase,
  não SQL).

---

## Testing Decisions

Bom teste = comportamento externo, não implementação. Prior art no repo:
`whatsapp-normalizer` (24 testes), `first-contact-metric`, `first-contact-urgency`,
`stage-transition-validator` (módulos puros + Vitest); integração com `skip` sem
`DATABASE_URL` (prior art `dedup-matcher`).

- **`date-range`** (Vitest): fronteiras `from/to` para `7d`/`30d`; mês calendário
  correto para `this_month`/`last_month` (incl. virada de mês/ano) em
  `America/Sao_Paulo`; `all` → sem limites; default `7d`.
- **`contact-links`** (Vitest): `mailto:` com/sem e-mail; `wa.me` só dígitos
  (remove `+`, espaços, parênteses); `instagram.com/<handle>` sem `@`; `null`
  quando o dado falta.
- **Funil de vendas (agregação)**: preferir testar a lógica pura de classificação
  "coletada vs em manutenção" e o mapeamento etapa→fonte; as queries com banco
  ficam como integração `skip` sem `DATABASE_URL`.
- **Bugs de UI** (sidebar scroll, animação de colapso, overflow de card, scroll
  da atividade recente, contatos clicáveis renderizando o `href` certo): validar
  **no navegador** (preview) — sem teste unitário para layout. Contatos clicáveis
  podem ter um teste leve de render do `href` se houver seam de componente.

---

## Out of Scope (fase posterior — **não** entra na entrega de hoje)

- **Integração ao vivo de Meta/Facebook Ads** — a página `tráfego pago.` continua
  com dados **mockup**; as etapas do funil que dependem de Ads (posts feitos,
  visualizações geradas) ficam com tag "em manutenção".
- **Integração Hotmart via webhook** — permanece o import por **CSV**
  (`hotmart-csv-parser` + `import-sal-sales`). Sem novo webhook agora.
- **GA4 + Clarity** ("Métricas Financeiras" unificadas) — frente inteira adiada.
- **Detecção real de follow-up por mensagens** — depende de sincronizar as
  conversas de WhatsApp (Evolution) para uma tabela `messages` no Supabase, que
  **não existe** hoje. Regra futura já definida (abaixo) para quando a fonte
  existir. Por ora, métrica "em manutenção".
- **Mover `pg_trgm` para outro schema** e **ativar leaked-password protection** —
  warnings, tratados fora desta entrega.

---

## Further Notes

### SQL de RLS (entregar ao André para aplicar no Supabase)

Habilita RLS em todas as tabelas públicas. Seguro: o app acessa via
`service_role`/conexão direta (ignora RLS); PostgREST anônimo passa a ser negado —
que é o estado desejado ("anon negado"). Idempotente.

```sql
alter table public.commercial_analyses  enable row level security;
alter table public.form_fields          enable row level security;
alter table public.form_responses       enable row level security;
alter table public.forms                 enable row level security;
alter table public.lead_action_log       enable row level security;
alter table public.lead_field_audit      enable row level security;
alter table public.lead_intake_log       enable row level security;
alter table public.lead_loss_reasons     enable row level security;
alter table public.lead_objections       enable row level security;
alter table public.lead_sources          enable row level security;
alter table public.lead_stage_history    enable row level security;
alter table public.lead_stages           enable row level security;
alter table public.leads                 enable row level security;
alter table public.meetings              enable row level security;
alter table public.products              enable row level security;
alter table public.roleplay_messages     enable row level security;
alter table public.roleplay_scenarios    enable row level security;
alter table public.roleplay_sessions     enable row level security;
alter table public.sal_sales             enable row level security;
alter table public.users                 enable row level security;
```

Warnings (opcionais, fora da entrega de hoje):
- **Leaked password protection**: painel Supabase → Authentication → Policies/
  Password → habilitar "Leaked password protection" (checagem HaveIBeenPwned).
  Não é SQL.
- **`pg_trgm` em `public`**: mover de schema exige recriar os índices trigram
  (`gin_trgm_ops`) que dependem da extensão — arriscado; deixar como pendência.

### Estado real verificado no Supabase (projeto `OS Comercial` / `fyhcpftzqczplmtykxke`)

- **20 tabelas** públicas, todas do schema Drizzle. **Não existe tabela de
  mensagens** (só `roleplay_messages`, do treino de IA). Confirma que follow-up
  por mensagem não é viável hoje.
- `meetings.status` = enum `agendada|realizada|nao_realizada|reagendada|cancelada`
  → agendadas vs comparecidas (realizada) são mensuráveis.
- `lead_stages` inclui `meeting_scheduled`, `meeting_done`, `proposal_sent`,
  `paid` → etapas do funil de vendas mapeáveis via `lead_stage_history`.
- `form_responses` existe → formulários enviados mensuráveis.
- `sal_sales` existe (estrutura Hotmart: transação, comprador, produto, comissão,
  UTM, `traffic_type`), alimentada por **CSV** — base para a conciliação
  financeira da fase posterior.

### Mapa "coletada vs em manutenção" (para a apresentação de hoje)

| Métrica / etapa do funil        | Fonte                                   | Status hoje        |
|---------------------------------|-----------------------------------------|--------------------|
| Posts feitos                    | Instagram/Meta content API              | 🔴 em manutenção   |
| Visualizações geradas           | Meta Ads / GA4                          | 🔴 em manutenção   |
| Formulários enviados            | `form_responses`                        | ✅ coletada        |
| Reuniões agendadas              | `meetings` (agendada+)                  | ✅ coletada        |
| Reuniões comparecidas           | `meetings.status='realizada'`           | ✅ coletada        |
| Propostas realizadas            | `lead_stage_history` → `proposal_sent`  | ✅ coletada        |
| Vendas feitas                   | `lead_stage_history` → `paid`           | ✅ coletada        |
| Follow-up por lead              | (tabela de mensagens inexistente)       | 🔴 em manutenção   |
| SLA 1º atendimento (por período)| `application_received_at`/`first_contact_at` | ✅ coletada   |

### Regra futura de follow-up (para quando a fonte de mensagens existir)

Sem tentar casar texto (as mensagens variam): considerar **follow-up** toda vez
que a **mesma pessoa (humano/time)** envia nova mensagem após **≥ 24h sem
resposta** do lead. O sistema mapeia quem foi o último a enviar e conta os
disparos subsequentes do time. Requer sincronizar as conversas de WhatsApp para
o Supabase — hoje elas vivem no store da Evolution e não estão no banco.

### Fluxo de entrega

1. Executor (outro modelo) implementa guiado por este PRD.
2. `pnpm typecheck` + `pnpm test` + verificação visual no preview.
3. **agente-auditor** confere PRD × diff/execução → APROVADO/REPROVADO.
4. Só então: commit (autor Rodrigo) + push + **PR** para o André aprovar (sem
   merge automático).

---

## Adendo (2026-07-13, sobre esta mesma branch) — reunião computa pelo kanban + evolução semanal

Pedido do Rodrigo depois do funil de período: (a) fazer o movimento do card no
kanban para "reunião agendada"/"reunião realizada" **computar** no funil; (b)
ver **tendência semana a semana**; (c) **taxa de conversão entre etapas** — tudo
em **tabelas simples**, sempre **4 linhas = 4 últimas semanas** (sem novo desenho
de funil), reaproveitando os placeholders "posts/alcance em manutenção".

**Causa do "não computava":** o funil de período contava reunião pela tabela
`meetings` (`getMeetingsScheduledCount`/`Attended`), que só é populada pelo
formulário na tela do lead. Arrastar o card grava em `lead_stage_history`, não em
`meetings` → reunião nunca aparecia.

**Mudanças (decisões travadas com o Rodrigo):**
- **Reunião passa a vir de `lead_stage_history`** (transições para
  `meeting_scheduled`/`meeting_done`), via o `getLeadsReachedStageCount` que o
  André já usava para proposta/venda. Isso **altera os números de reunião do
  funil de período** desta branch — passam a refletir o kanban (fonte de verdade
  da operação). Perde o detalhe no-show/cancelada da tabela `meetings`.
- **Conversão = fluxo na semana** (throughput: `etapa_seguinte ÷ etapa_anterior`
  da mesma semana; **não** coorte). Denominador 0 → `—`.
- **Etapas = conjunto longo** (leads → formulário → qualificado → 1º contato →
  reunião agendada → realizada → proposta → venda) + `posts`/`alcance` "em
  manutenção".

**Implementação:** módulos puros `server/lib/week-range` (`lastNWeeks`, `to`
exclusivo, SP tz) e `server/lib/week-range/conversion` (`weeklyConversions`) com
testes; `getWeeklyFunnel()` em `commercial-funnel.ts` reusa
`getCommercialFunnelCounts` por semana; UI `dashboard/_components/weekly-funnel-section.tsx`
(duas tabelas, 4 linhas, scroll horizontal), renderizada logo abaixo do funil de
período. **Fixo em 4 semanas** — independe do `PeriodFilter`.

**Verificação:** `pnpm typecheck` 0 erros; 230 testes passando (11 novos:
`week-range` + `conversion`), 8 skip esperado. Verificação visual ao vivo
pendente (ambiente sem `.env.local`/banco) — a fazer no preview.
