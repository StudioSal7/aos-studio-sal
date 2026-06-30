# Sinal de "primeiro contato pendente" no Kanban

**Data:** 2026-06-30
**Status:** Design aprovado — aguardando revisão do spec antes do plano de implementação
**Branch:** `otimizacao-comercial`

---

## Problema

A SDR não tem destaque visual para priorizar leads que acabaram de aplicar e ainda não
receberam o primeiro contato. Hoje o card do Kanban só destaca `requiresAttention` (quente)
e `needsManualReview` (revisão) via borda esquerda. Um lead fresco se mistura com leads
antigos na mesma coluna, e leads esquecidos nas fases pré-contato não chamam atenção.

## Objetivo

Marcação visual no card do Kanban que sinaliza, para a SDR, **há quanto tempo um lead está
esperando o primeiro contato** — calma quando fresco, urgente quando passou do SLA, e some
quando alguém efetivamente contatou.

## Fundamentação (boas práticas de speed-to-lead)

- Contato em até 5 min → 21× mais chance de qualificar, 100× mais chance de falar
  (estudo de James Oldroyd / Lead Response Management). O número de 5 min é de alto volume;
  a **direção** vale para qualquer operação: lead fresco contatado rápido converte mais.
- ~78% dos clientes compram de quem responde primeiro.
- Princípio de **SLA aging / escalation**: lead não-contatado dentro do SLA **não some — ele
  escala** (muda de cor, vira fila de "breach"). A função do sinal é impedir que o lead "caia
  numa fenda". Por isso o segundo estado é o **mais** urgente, não um "pendente" suave.

Adaptação à operação (≈200 leads/ano, ~4/semana, 1 SDR): SLA de primeiro contato = **24h**.
Não é pressão de 5 minutos; é "não deixar o lead virar a noite esquecido".

## Modelo de estados

O sinal combina **dois eixos**: tempo (define o rótulo/urgência) + ação (define se aparece).
"A SDR agiu" é representado pelo lead **sair dos estágios pré-contato** — sem campo novo de
"contato feito".

Estágios pré-contato (slugs imutáveis, posições 1–3):
`application_received` · `under_review` · `qualified`

Primeiro contato real = `first_contact_sent` (posição 4).

| Estado | Condição | Visual |
|---|---|---|
| 🟢 **novo** | estágio pré-contato **e** `application_received_at` não-nulo **e** idade < 24h | pílula calma, cor `leaf` |
| 🔴 **atrasado** | estágio pré-contato **e** `application_received_at` não-nulo **e** idade ≥ 24h | pílula forte, cor `signal-hot` (+ idade, ex: "atrasado · 3d") |
| ⚪ (nada) | estágio `first_contact_sent` ou além, **ou** `application_received_at` nulo | sem pílula |

`idade = now − application_received_at`.

## Dados

Não existe campo `receivedAt` — só `createdAt`. Para leads novos via formulário/webhook,
`createdAt` é a hora da aplicação; mas usá-lo direto faria os **~93 leads legados** (CSV,
`createdAt` = data da importação) acenderem "atrasado" no dia 1 — poluição que mata o sinal.

**Decisão:** nova coluna nullable `application_received_at timestamptz` em `leads`.
- Preenchida **só na entrada ao vivo**: `server/lib/lead-intake/ingestLead` (submit de
  formulário) e o webhook Respondi (`app/api/webhooks/leads/respondi/route.ts`), no momento
  da criação do lead, com o mesmo instante de `createdAt`/agora.
- Leads legados e quaisquer leads sem esse timestamp ficam **null → sem sinal**.
- Semântica: "aplicação que chegou pelo funil ao vivo". O sinal sempre significa aplicação
  real e fresca; o backlog histórico não acende.

Sem backfill dos legados (decisão explícita: não sinalizar legados).

## Derivação (sem cron, sem flag manual)

Calculado em **tempo de render, no servidor** (na montagem dos dados do Kanban), onde o
slug do estágio é conhecido. Produz um enum derivado:

```ts
firstContactUrgency: 'new' | 'overdue' | null
```

- Computar server-side evita mismatch de hidratação e problema de timezone (o `now` é do
  servidor). O card recebe o enum pronto e só renderiza a pílula — fica "burro".
- A query/montagem do Kanban precisa ter o **slug do estágio** disponível no ponto onde
  hoje monta `KanbanLead` (que carrega `stageId` uuid, não slug) para decidir se é pré-contato.

Limite de pré-contato como constante compartilhada (ex.: `PRE_CONTACT_STAGE_SLUGS`) para não
espalhar string literal.

## Visual

Borda esquerda já está ocupada (`requiresAttention` → `signal-hot`; `needsManualReview` →
`signal-review`). Um terceiro sinal na borda colidiria. Então: **pílula pequena no topo do
card**, estilo editorial lowercase, coerente com o texto "confirmar reunião" já existente
(`text-micro`).

```
┌─────────────────────────────┐      ┌─────────────────────────────┐
│ ● novo                      │      │ ● atrasado · 3d             │
│ Carol (Maria Carolina)      │      │ Bru (Bruna Neiman)          │
│ mcarolina.silvausa@gmail... │      │ bru_tb@hotmail.com          │
└─────────────────────────────┘      └─────────────────────────────┘
   leaf, calmo                          signal-hot, forte
```

Um lead pode ter a pílula **e** as bordas de `requiresAttention`/`needsManualReview` ao mesmo
tempo — são sinais ortogonais (tempo de espera vs. saúde/revisão do dado) e podem coexistir.

## Escopo

**Dentro:**
- Coluna `application_received_at` + população na entrada ao vivo (form + webhook).
- Derivação `firstContactUrgency` na montagem do Kanban.
- Pílula no `lead-card.tsx`.

**Fora (pode vir depois):**
- Reordenar colunas por urgência (atrasado no topo).
- Notificação externa (Slack/email) ao estourar SLA.
- Campo dedicado de "contato feito" (a ação é mover o card).
- Aplicar o sinal a outras views além do Kanban.

## Edge cases

- Lead sem `application_received_at` (legado ou criado por outro caminho) → sem pílula.
- Lead movido para `first_contact_sent`+ → pílula some imediatamente no próximo render.
- Lead que volta de um estágio avançado para pré-contato → a pílula reaparece (calculado
  por idade desde a aplicação; se já passou 24h, aparece como "atrasado"). Comportamento
  aceitável — reflete que voltou para a fila de contato.
- `idade < 0` (relógio/fuso) → tratar como "novo" (clamp em 0).

## Critério de pronto

1. Lead novo via formulário/webhook nasce com `application_received_at`.
2. Card de lead pré-contato < 24h mostra pílula "novo" (leaf).
3. Card de lead pré-contato ≥ 24h mostra pílula "atrasado" (signal-hot) + idade.
4. Card em `first_contact_sent`+ não mostra pílula.
5. Nenhum dos ~93 leads legados acende a pílula.
6. `tsc --noEmit` limpo; sem regressão nos testes.
