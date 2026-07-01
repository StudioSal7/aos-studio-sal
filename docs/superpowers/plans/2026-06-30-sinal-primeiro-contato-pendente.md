# Sinal de "primeiro contato pendente" no Kanban — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma pílula no card do Kanban que sinaliza, para a SDR, há quanto tempo um lead espera o primeiro contato — `novo` (verde, <24h) e `atrasado` (forte, ≥24h) nos estágios pré-contato, sumindo ao chegar em "primeiro contato enviado".

**Architecture:** Função pura testável (`computeFirstContactSignal`) deriva o estado a partir de `stageSlug` + `applicationReceivedAt` + `now`. Uma nova coluna nullable `application_received_at` é preenchida só na entrada ao vivo (formulário + webhook Respondi); legados ficam null → sem sinal. A query do Kanban traz a coluna; a página deriva o sinal server-side (sem hidratação/timezone) e passa um objeto pronto para o card renderizar.

**Tech Stack:** Next.js 15 App Router (Server Components), Drizzle ORM, Vitest, Tailwind v4 (tokens semânticos Studio Sal).

**Spec:** [`docs/superpowers/specs/2026-06-30-sinal-primeiro-contato-pendente-design.md`](../specs/2026-06-30-sinal-primeiro-contato-pendente-design.md)

---

## File Structure

- **Create:** `apps/crm/src/server/lib/first-contact-urgency/index.ts` — módulo puro: constante `PRE_CONTACT_STAGE_SLUGS`, tipo `FirstContactSignal`, função `computeFirstContactSignal`.
- **Create:** `apps/crm/src/server/lib/first-contact-urgency/index.test.ts` — testes Vitest.
- **Modify:** `packages/db/src/schema/leads.ts` — coluna `applicationReceivedAt`.
- **Modify (gerado):** nova migration SQL via `pnpm db:generate`.
- **Modify:** `apps/crm/src/server/lib/lead-intake/index.ts:124-151` — setar `applicationReceivedAt` no insert.
- **Modify:** `apps/crm/src/app/api/webhooks/leads/respondi/route.ts:124-147` — setar `applicationReceivedAt` no insert.
- **Modify:** `apps/crm/src/server/queries/leads.ts:11-42` — selecionar `applicationReceivedAt`.
- **Modify:** `apps/crm/src/app/(crm)/kanban/page.tsx` — derivar o sinal e serializar.
- **Modify:** `apps/crm/src/app/(crm)/_components/kanban-board.tsx:33-54` — campo `firstContactSignal` no tipo `KanbanLead`.
- **Modify:** `apps/crm/src/app/(crm)/_components/lead-card.tsx:42-59` — renderizar a pílula.

---

## Task 1: Módulo puro `computeFirstContactSignal`

**Files:**
- Create: `apps/crm/src/server/lib/first-contact-urgency/index.ts`
- Test: `apps/crm/src/server/lib/first-contact-urgency/index.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/crm/src/server/lib/first-contact-urgency/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeFirstContactSignal, PRE_CONTACT_STAGE_SLUGS } from './index';

const NOW = new Date('2026-06-30T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

describe('computeFirstContactSignal', () => {
  it('retorna null quando applicationReceivedAt é null (legado)', () => {
    expect(
      computeFirstContactSignal({
        stageSlug: 'application_received',
        applicationReceivedAt: null,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('retorna null quando o estágio não é pré-contato', () => {
    expect(
      computeFirstContactSignal({
        stageSlug: 'first_contact_sent',
        applicationReceivedAt: hoursAgo(1),
        now: NOW,
      }),
    ).toBeNull();
  });

  it('retorna "new" com ageDays 0 quando < 24h em estágio pré-contato', () => {
    expect(
      computeFirstContactSignal({
        stageSlug: 'application_received',
        applicationReceivedAt: hoursAgo(5),
        now: NOW,
      }),
    ).toEqual({ urgency: 'new', ageDays: 0 });
  });

  it('retorna "overdue" quando exatamente 24h (limite do SLA)', () => {
    expect(
      computeFirstContactSignal({
        stageSlug: 'under_review',
        applicationReceivedAt: hoursAgo(24),
        now: NOW,
      }),
    ).toEqual({ urgency: 'overdue', ageDays: 1 });
  });

  it('retorna "overdue" com ageDays correto para 3 dias em "qualified"', () => {
    expect(
      computeFirstContactSignal({
        stageSlug: 'qualified',
        applicationReceivedAt: hoursAgo(72),
        now: NOW,
      }),
    ).toEqual({ urgency: 'overdue', ageDays: 3 });
  });

  it('faz clamp de idade negativa (relógio/fuso) em "new" ageDays 0', () => {
    expect(
      computeFirstContactSignal({
        stageSlug: 'application_received',
        applicationReceivedAt: hoursAgo(-2),
        now: NOW,
      }),
    ).toEqual({ urgency: 'new', ageDays: 0 });
  });

  it('expõe os três slugs pré-contato', () => {
    expect(PRE_CONTACT_STAGE_SLUGS).toEqual([
      'application_received',
      'under_review',
      'qualified',
    ]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter crm test -- first-contact-urgency`
Expected: FAIL — `Cannot find module './index'` / `computeFirstContactSignal is not a function`.

- [ ] **Step 3: Implementar o módulo**

Create `apps/crm/src/server/lib/first-contact-urgency/index.ts`:

```ts
/**
 * Deriva o sinal de "primeiro contato pendente" para o card do Kanban.
 *
 * Módulo puro (sem DB) — calculado em tempo de render, server-side. Combina dois
 * eixos: tempo (idade desde a aplicação) define a urgência; estágio (ação da SDR)
 * define se o sinal aparece. Some quando o lead sai dos estágios pré-contato.
 *
 * Leads sem applicationReceivedAt (legados/backlog) nunca acendem o sinal.
 */

/** Estágios anteriores ao primeiro contato real (`first_contact_sent`, posição 4). */
export const PRE_CONTACT_STAGE_SLUGS = [
  'application_received',
  'under_review',
  'qualified',
] as const;

/** Janela de SLA do primeiro contato, em horas. */
const SLA_HOURS = 24;

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

export type FirstContactSignal = { urgency: 'new' | 'overdue'; ageDays: number } | null;

export function computeFirstContactSignal(params: {
  stageSlug: string;
  applicationReceivedAt: Date | null;
  now: Date;
}): FirstContactSignal {
  const { stageSlug, applicationReceivedAt, now } = params;

  if (applicationReceivedAt === null) return null;
  if (!(PRE_CONTACT_STAGE_SLUGS as readonly string[]).includes(stageSlug)) return null;

  const ageMs = Math.max(0, now.getTime() - applicationReceivedAt.getTime());
  const ageDays = Math.floor(ageMs / MS_PER_DAY);
  const urgency = ageMs >= SLA_HOURS * MS_PER_HOUR ? 'overdue' : 'new';

  return { urgency, ageDays };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter crm test -- first-contact-urgency`
Expected: PASS — 7 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add apps/crm/src/server/lib/first-contact-urgency/
git commit --author="Rodrigo Albuquerque <rodrigo@benitesalbuquerque.com.br>" -m "feat(crm): módulo puro do sinal de primeiro contato pendente

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Coluna `application_received_at` no schema + migration

**Files:**
- Modify: `packages/db/src/schema/leads.ts:90-93`

- [ ] **Step 1: Adicionar a coluna ao schema**

Em `packages/db/src/schema/leads.ts`, no bloco `// Timestamps` (logo após `createdAt`, linha 91), adicionar:

```ts
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    applicationReceivedAt: timestamp('application_received_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
```

(coluna nullable, sem default — só preenchida na entrada ao vivo.)

- [ ] **Step 2: Gerar a migration**

Run: `pnpm db:generate`
Expected: cria um arquivo novo em `packages/db/drizzle/` (ex: `0007_*.sql`) contendo `ALTER TABLE "leads" ADD COLUMN "application_received_at" timestamp with time zone;`

- [ ] **Step 3: Conferir o SQL gerado**

Run: `git status --short packages/db/drizzle/`
Expected: um `.sql` novo + alteração no snapshot/journal do drizzle. Abrir o `.sql` e confirmar que é só `ADD COLUMN ... timestamp with time zone` (nullable, sem `NOT NULL`, sem default). Se vier algo destrutivo (DROP/ALTER de outra coluna), PARAR e revisar.

- [ ] **Step 4: Aplicar a migration no banco**

Run: `pnpm db:migrate`
Expected: aplica sem erro. (Coluna nullable em tabela existente — operação segura, não toca dados existentes.)

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/leads.ts packages/db/drizzle/
git commit --author="Rodrigo Albuquerque <rodrigo@benitesalbuquerque.com.br>" -m "feat(db): coluna application_received_at em leads (nullable)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Popular `application_received_at` na entrada ao vivo

Ambos os caminhos de criação de lead (formulário via `ingestLead` e webhook Respondi inline) já usam `lead.receivedAt: Date` para `createdAt`. Setar a coluna nova com o mesmo valor. Legados (script de import) não tocam esse insert → ficam null.

**Files:**
- Modify: `apps/crm/src/server/lib/lead-intake/index.ts:149`
- Modify: `apps/crm/src/app/api/webhooks/leads/respondi/route.ts:145`

- [ ] **Step 1: Setar no `ingestLead` (formulário)**

Em `apps/crm/src/server/lib/lead-intake/index.ts`, no objeto `.values({...})` do insert, adicionar a linha junto aos timestamps (logo antes de `createdAt: lead.receivedAt,`):

```ts
      stageId: stage.id,
      needsManualReview: ctx.flagReview ? true : undefined,
      manualReviewReason: ctx.flagReview ?? undefined,
      applicationReceivedAt: lead.receivedAt,
      createdAt: lead.receivedAt,
      updatedAt: lead.receivedAt,
```

- [ ] **Step 2: Setar no webhook Respondi**

Em `apps/crm/src/app/api/webhooks/leads/respondi/route.ts`, no objeto `.values({...})` do insert, adicionar junto aos timestamps (logo antes de `createdAt: lead.receivedAt,`):

```ts
      stageId: stage.id,
      applicationReceivedAt: lead.receivedAt,
      createdAt: lead.receivedAt,
      updatedAt: lead.receivedAt,
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: 0 erros (a coluna existe no schema desde a Task 2; `lead.receivedAt` é `Date`).

- [ ] **Step 4: Commit**

```bash
git add apps/crm/src/server/lib/lead-intake/index.ts apps/crm/src/app/api/webhooks/leads/respondi/route.ts
git commit --author="Rodrigo Albuquerque <rodrigo@benitesalbuquerque.com.br>" -m "feat(crm): grava application_received_at na entrada ao vivo (form + webhook)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Trazer a coluna na query e derivar o sinal na página

**Files:**
- Modify: `apps/crm/src/server/queries/leads.ts:31`
- Modify: `apps/crm/src/app/(crm)/_components/kanban-board.tsx:33-54`
- Modify: `apps/crm/src/app/(crm)/kanban/page.tsx`

- [ ] **Step 1: Selecionar `applicationReceivedAt` na query do Kanban**

Em `apps/crm/src/server/queries/leads.ts`, dentro do `.select({...})` de `getKanbanLeads` (após `createdAt: schema.leads.createdAt,`, linha 31), adicionar:

```ts
      createdAt: schema.leads.createdAt,
      applicationReceivedAt: schema.leads.applicationReceivedAt,
      updatedAt: schema.leads.updatedAt,
```

- [ ] **Step 2: Adicionar o campo ao tipo `KanbanLead`**

Em `apps/crm/src/app/(crm)/_components/kanban-board.tsx`, importar o tipo no topo (junto aos imports existentes) e adicionar o campo ao tipo `KanbanLead`:

No topo do arquivo, adicionar o import de tipo (não puxa código de servidor — é só o tipo):

```ts
import type { FirstContactSignal } from '@/server/lib/first-contact-urgency';
```

No `export type KanbanLead = {...}`, adicionar o campo (após `hasUnconfirmedMeeting: boolean;`):

```ts
  hasUnconfirmedMeeting: boolean;
  firstContactSignal: FirstContactSignal;
};
```

- [ ] **Step 3: Derivar o sinal e serializar na página**

Substituir o conteúdo de `apps/crm/src/app/(crm)/kanban/page.tsx` por (a desestruturação `{ applicationReceivedAt, ...l }` descarta a coluna crua do payload serializado e a usa só para derivar o sinal, mantendo `KanbanLead` limpo):

```tsx
import { getKanbanLeads, getAllLossReasons } from '@/server/queries/leads';
import { computeFirstContactSignal } from '@/server/lib/first-contact-urgency';
import { KanbanBoard } from '../_components/kanban-board';

export default async function KanbanPage() {
  const [{ stages, leads }, lossReasons] = await Promise.all([
    getKanbanLeads(),
    getAllLossReasons(),
  ]);
  const stageSlugById = new Map(stages.map((s) => [s.id, s.slug]));
  const now = new Date();
  const serializedLeads = leads.map(({ applicationReceivedAt, ...l }) => ({
    ...l,
    nextActionAt: l.nextActionAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    firstContactSignal: computeFirstContactSignal({
      stageSlug: stageSlugById.get(l.stageId) ?? '',
      applicationReceivedAt,
      now,
    }),
  }));
  return <KanbanBoard stages={stages} leads={serializedLeads} lossReasons={lossReasons} />;
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: 0 erros. (`stages` tem `id` e `slug` do `select()` completo de `leadStages`; `FirstContactSignal` casa entre página e tipo `KanbanLead`.)

- [ ] **Step 5: Commit**

```bash
git add apps/crm/src/server/queries/leads.ts apps/crm/src/app/\(crm\)/_components/kanban-board.tsx apps/crm/src/app/\(crm\)/kanban/page.tsx
git commit --author="Rodrigo Albuquerque <rodrigo@benitesalbuquerque.com.br>" -m "feat(crm): deriva firstContactSignal na montagem do Kanban

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Renderizar a pílula no card

**Files:**
- Modify: `apps/crm/src/app/(crm)/_components/lead-card.tsx:42-59`

- [ ] **Step 1: Renderizar a pílula acima do nome**

Em `apps/crm/src/app/(crm)/_components/lead-card.tsx`, dentro do `<div className="min-w-0">` (linha 43), antes do `<p>` do nome, inserir a pílula:

```tsx
        <div className="min-w-0">
          {lead.firstContactSignal && (
            <span
              className={cn(
                'mb-1 inline-flex items-center gap-1 text-micro',
                lead.firstContactSignal.urgency === 'overdue'
                  ? 'bg-signal-hot px-1.5 py-0.5 text-paper'
                  : 'text-leaf',
              )}
            >
              <span
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full',
                  lead.firstContactSignal.urgency === 'overdue' ? 'bg-paper' : 'bg-leaf',
                )}
              />
              {lead.firstContactSignal.urgency === 'overdue'
                ? `atrasado${lead.firstContactSignal.ageDays > 0 ? ` · ${lead.firstContactSignal.ageDays}d` : ''}`
                : 'novo'}
            </span>
          )}
          <p className="truncate text-body text-ink">
```

Isso renderiza:
- `novo` → texto verde (`text-leaf`) com bolinha — calmo.
- `atrasado` / `atrasado · 3d` → pílula preenchida `bg-signal-hot` com texto claro (`text-paper`) — forte.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: 0 erros. (`cn` já é importado no arquivo; `lead.firstContactSignal` existe no tipo `KanbanLead`.)

- [ ] **Step 3: Rodar a suíte completa de testes**

Run: `pnpm --filter crm test`
Expected: tudo verde — 173 passando (166 anteriores + 7 novos), 8 skipped, 0 falhas.

- [ ] **Step 4: Verificação manual no navegador**

Run: `pnpm --filter crm dev` e abrir `/kanban`.
Expected:
- Nenhum dos ~93 leads legados mostra pílula (todos com `application_received_at` null).
- (Opcional, para provar o caminho feliz) submeter o form `/f/aplicacao-sal` ou disparar um lead de teste → o novo lead aparece em "aplicação recebida" com pílula `novo` (verde). Após 24h (ou ajustando o relógio/registro de teste) viraria `atrasado`.

- [ ] **Step 5: Commit**

```bash
git add apps/crm/src/app/\(crm\)/_components/lead-card.tsx
git commit --author="Rodrigo Albuquerque <rodrigo@benitesalbuquerque.com.br>" -m "feat(crm): pílula novo/atrasado no card do Kanban

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Atualizar documentação

**Files:**
- Modify: `CLAUDE.md` (raiz) — seção de decisões/estado
- Modify: `apps/crm/CLAUDE.md` — deep modules

- [ ] **Step 1: Registrar o módulo novo em `apps/crm/CLAUDE.md`**

Na tabela "Deep modules", adicionar a linha:

```markdown
| `server/lib/first-contact-urgency/` | Puro | 7 passando |
```

- [ ] **Step 2: Registrar a decisão no `CLAUDE.md` raiz**

Na seção "Decisões arquiteturais importantes", adicionar o bullet:

```markdown
- **Sinal de primeiro contato pendente no Kanban** — pílula `novo` (<24h, `text-leaf`) / `atrasado` (≥24h, `bg-signal-hot`) nos estágios pré-contato (`application_received`/`under_review`/`qualified`); some ao chegar em `first_contact_sent`. Derivado server-side em `server/lib/first-contact-urgency` (puro) a partir de `leads.application_received_at` (nullable, preenchida só na entrada ao vivo — form + webhook; legados null → sem sinal). Sem cron, sem flag manual: a ação que limpa o sinal é a SDR mover o card. SLA = 24h.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md apps/crm/CLAUDE.md
git commit --author="Rodrigo Albuquerque <rodrigo@benitesalbuquerque.com.br>" -m "docs: registra sinal de primeiro contato pendente

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Critério de pronto (verificação final)

1. `pnpm typecheck` → 0 erros.
2. `pnpm --filter crm test` → 173 passando, 8 skipped, 0 falhas.
3. Lead novo via formulário/webhook nasce com `application_received_at` preenchido.
4. Card pré-contato < 24h → pílula `novo` (verde); ≥ 24h → `atrasado` (forte) + idade.
5. Card em `first_contact_sent`+ → sem pílula.
6. Nenhum dos ~93 leads legados acende a pílula.
