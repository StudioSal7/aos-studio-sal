# Tempo até o primeiro contato — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar o momento do primeiro contato de cada lead (`leads.first_contact_at`) e expor no dashboard a métrica "tempo até 1º contato" (mediana + % dentro do SLA de 24h), medindo quanto a SDR demora entre a aplicação e o primeiro contato.

**Architecture:** O cronômetro começa em `application_received_at` (coluna já existente) e para em uma nova coluna `first_contact_at`, gravada transacionalmente em `updateLeadStageAction` no primeiro momento em que o lead **sai do pré-contato** para o caminho de contato. A métrica é derivada no dashboard por subtração das duas colunas, com mediana e % no SLA calculados num módulo puro testável. Leads históricos recebem `first_contact_at` via backfill a partir de `lead_stage_history` (fonte de verdade append-only).

**Tech Stack:** Next.js 15 App Router (Server Components + Server Actions), Drizzle ORM + postgres.js, Vitest.

---

## Decisões de produto (já validadas com o Rodrigo)

1. **O que conta como "primeiro contato":** o **primeiro momento em que o lead sai dos estágios pré-contato** (`application_received`/`under_review`/`qualified`) para o **caminho de contato** — entrar em `first_contact_sent` OU pular direto para qualquer estágio posterior (reunião agendada, etc.). **Mover para `lost` NÃO conta** (saída sem contato, ex: qualificação reprovada/spam). Registra-se apenas o **primeiro** (set-once).
2. **Como mostrar no dashboard:** **mediana** do tempo (robusta a outliers) + **% dos leads contatados dentro de 24h**. Card único, com a mediana como valor e `% em 24h · base N` na nota.

**Anchor de início:** `application_received_at`. Leads sem esse timestamp (legados de CSV) ficam fora da métrica — não temos tempo de início confiável para eles. A base começa pequena (poucos leads `formulario_web`) e cresce conforme a operação roda.

---

## File Structure

- **Modify:** `apps/crm/src/server/lib/first-contact-urgency/index.ts` — exportar `CONTACT_PATH_STAGE_SLUGS` + `reachesFirstContact()`.
- **Modify:** `apps/crm/src/server/lib/first-contact-urgency/index.test.ts` — testes do novo predicado.
- **Create:** `apps/crm/src/server/lib/first-contact-metric/index.ts` — módulo puro de estatística (mediana + % SLA).
- **Create:** `apps/crm/src/server/lib/first-contact-metric/index.test.ts` — testes.
- **Modify:** `packages/db/src/schema/leads.ts` — coluna `firstContactAt`.
- **Modify (gerado, isolado):** nova migration SQL via `pnpm db:generate`.
- **Modify:** `apps/crm/src/server/actions/leads.ts` — gravar `first_contact_at` na transição.
- **Create:** `apps/crm/scripts/backfill-first-contact-at.ts` + entry no `apps/crm/package.json`.
- **Modify:** `apps/crm/src/server/queries/dashboard.ts` — query `getTimeToFirstContact`.
- **Modify:** `apps/crm/src/app/(crm)/dashboard/page.tsx` — computar + renderizar o card.
- **Modify:** `CLAUDE.md` (raiz) + `apps/crm/CLAUDE.md` — docs.

---

## Task 1: Predicado `reachesFirstContact` (módulo puro existente)

**Files:**
- Modify: `apps/crm/src/server/lib/first-contact-urgency/index.ts`
- Test: `apps/crm/src/server/lib/first-contact-urgency/index.test.ts`

- [ ] **Step 1: Adicionar os testes ao arquivo existente**

No fim de `apps/crm/src/server/lib/first-contact-urgency/index.test.ts`, antes do fechamento, adicionar um novo bloco `describe` (e incluir `reachesFirstContact`/`CONTACT_PATH_STAGE_SLUGS` no import do topo):

```ts
import {
  computeFirstContactSignal,
  PRE_CONTACT_STAGE_SLUGS,
  reachesFirstContact,
  CONTACT_PATH_STAGE_SLUGS,
} from './index';
```

```ts
describe('reachesFirstContact', () => {
  it('true ao entrar em first_contact_sent', () => {
    expect(reachesFirstContact('first_contact_sent')).toBe(true);
  });

  it('true ao pular direto para meeting_scheduled', () => {
    expect(reachesFirstContact('meeting_scheduled')).toBe(true);
  });

  it('true para paid (won — houve contato)', () => {
    expect(reachesFirstContact('paid')).toBe(true);
  });

  it('false para estágios pré-contato', () => {
    expect(reachesFirstContact('application_received')).toBe(false);
    expect(reachesFirstContact('under_review')).toBe(false);
    expect(reachesFirstContact('qualified')).toBe(false);
  });

  it('false para lost (saída sem contato)', () => {
    expect(reachesFirstContact('lost')).toBe(false);
  });

  it('CONTACT_PATH_STAGE_SLUGS não intersecta PRE_CONTACT_STAGE_SLUGS', () => {
    const pre = new Set<string>(PRE_CONTACT_STAGE_SLUGS);
    expect(CONTACT_PATH_STAGE_SLUGS.some((s) => pre.has(s))).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter crm test -- first-contact-urgency`
Expected: FAIL — `reachesFirstContact is not a function` / `CONTACT_PATH_STAGE_SLUGS` undefined.

- [ ] **Step 3: Implementar no módulo**

No fim de `apps/crm/src/server/lib/first-contact-urgency/index.ts`, adicionar:

```ts
/**
 * Estágios no caminho de contato — entrar em qualquer um marca o primeiro
 * contato. Exclui os pré-contato (posições 1–3) e `lost` (posição 11, saída
 * sem contato, ex: qualificação reprovada / fake-spam).
 */
export const CONTACT_PATH_STAGE_SLUGS = [
  'first_contact_sent',
  'meeting_scheduled',
  'meeting_done',
  'proposal_sent',
  'closed_verbally',
  'contract_sent',
  'paid',
] as const;

/**
 * True quando mover para `toStageSlug` representa o primeiro contato (lead saiu
 * do pré-contato para o caminho de contato). O chamador deve combinar com um
 * guard `firstContactAt == null` para registrar somente o PRIMEIRO contato.
 */
export function reachesFirstContact(toStageSlug: string): boolean {
  return (CONTACT_PATH_STAGE_SLUGS as readonly string[]).includes(toStageSlug);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter crm test -- first-contact-urgency`
Expected: PASS — os 7 testes anteriores + os 6 novos.

- [ ] **Step 5: Commit**

```bash
git add apps/crm/src/server/lib/first-contact-urgency/
git commit --author="Rodrigo Albuquerque <rodrigo@benitesalbuquerque.com.br>" -m "feat(crm): predicado reachesFirstContact (saída do pré-contato)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Módulo puro de estatística `computeFirstContactMetric`

**Files:**
- Create: `apps/crm/src/server/lib/first-contact-metric/index.ts`
- Test: `apps/crm/src/server/lib/first-contact-metric/index.test.ts`

- [ ] **Step 1: Escrever o teste**

Create `apps/crm/src/server/lib/first-contact-metric/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeFirstContactMetric } from './index';

const H = 3600; // 1h em segundos

describe('computeFirstContactMetric', () => {
  it('retorna zeros/null para lista vazia', () => {
    expect(computeFirstContactMetric([])).toEqual({
      count: 0,
      medianSeconds: null,
      withinSlaPct: null,
    });
  });

  it('mediana ímpar = elemento do meio', () => {
    const r = computeFirstContactMetric([1 * H, 5 * H, 3 * H]);
    expect(r.count).toBe(3);
    expect(r.medianSeconds).toBe(3 * H);
  });

  it('mediana par = média dos dois centrais', () => {
    const r = computeFirstContactMetric([2 * H, 4 * H, 6 * H, 8 * H]);
    expect(r.medianSeconds).toBe(5 * H);
  });

  it('% no SLA conta <= 24h (inclusive)', () => {
    // 12h, 24h dentro; 30h, 48h fora → 2/4 = 50%
    const r = computeFirstContactMetric([12 * H, 24 * H, 30 * H, 48 * H]);
    expect(r.withinSlaPct).toBe(50);
  });

  it('100% quando todos dentro do SLA', () => {
    const r = computeFirstContactMetric([1 * H, 2 * H, 10 * H]);
    expect(r.withinSlaPct).toBe(100);
  });

  it('ignora durações negativas/inválidas', () => {
    const r = computeFirstContactMetric([-5 * H, 2 * H, NaN, 4 * H]);
    expect(r.count).toBe(2);
    expect(r.medianSeconds).toBe(3 * H);
  });

  it('respeita slaHours customizado', () => {
    const r = computeFirstContactMetric([2 * H, 10 * H], 4);
    expect(r.withinSlaPct).toBe(50); // só 2h <= 4h
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter crm test -- first-contact-metric`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Create `apps/crm/src/server/lib/first-contact-metric/index.ts`:

```ts
/**
 * Estatística do "tempo até o primeiro contato" para o dashboard.
 *
 * Módulo puro (sem DB). Recebe durações em segundos (1 por lead que já teve
 * primeiro contato) e devolve mediana + % dentro do SLA. Mediana porque a
 * distribuição de tempo de resposta é torta — um lead esquecido distorce a
 * média, não a mediana.
 */

export interface FirstContactMetric {
  /** Quantos leads entraram no cálculo (base amostral). */
  count: number;
  /** Mediana em segundos, ou null se base vazia. */
  medianSeconds: number | null;
  /** % de leads contatados dentro do SLA (inteiro 0–100), ou null se base vazia. */
  withinSlaPct: number | null;
}

const DEFAULT_SLA_HOURS = 24;

export function computeFirstContactMetric(
  durationsSeconds: number[],
  slaHours: number = DEFAULT_SLA_HOURS,
): FirstContactMetric {
  const valid = durationsSeconds
    .filter((d) => Number.isFinite(d) && d >= 0)
    .sort((a, b) => a - b);

  const count = valid.length;
  if (count === 0) return { count: 0, medianSeconds: null, withinSlaPct: null };

  const mid = Math.floor(count / 2);
  const medianSeconds =
    count % 2 === 0 ? (valid[mid - 1] + valid[mid]) / 2 : valid[mid];

  const slaSeconds = slaHours * 3600;
  const withinSla = valid.filter((d) => d <= slaSeconds).length;
  const withinSlaPct = Math.round((withinSla / count) * 100);

  return { count, medianSeconds, withinSlaPct };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter crm test -- first-contact-metric`
Expected: PASS — 7 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/crm/src/server/lib/first-contact-metric/
git commit --author="Rodrigo Albuquerque <rodrigo@benitesalbuquerque.com.br>" -m "feat(crm): módulo puro da métrica tempo até 1º contato (mediana + % SLA)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Coluna `first_contact_at` + migration (com isolamento do drift bio)

⚠️ **Atenção ao drift:** o working tree tem schema não-commitado de outra feature (`bio-rate-limit`, exportado em `packages/db/src/schema/index.ts`). O `pnpm db:generate` vai querer empacotar a tabela `bio_rate_limit` junto. **Isolar** removendo o export temporariamente durante a geração — exatamente como foi feito na migration `0009`.

**Files:**
- Modify: `packages/db/src/schema/leads.ts`
- Modify (temporário, restaurar): `packages/db/src/schema/index.ts`

- [ ] **Step 1: Adicionar a coluna ao schema**

Em `packages/db/src/schema/leads.ts`, no bloco `// Timestamps`, logo após `applicationReceivedAt`:

```ts
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    applicationReceivedAt: timestamp('application_received_at', { withTimezone: true }),
    firstContactAt: timestamp('first_contact_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
```

- [ ] **Step 2: Remover temporariamente o export do bio do schema index**

Em `packages/db/src/schema/index.ts`, comentar a linha do bio-rate-limit:

```ts
// export * from './bio-rate-limit'; // temp: excluído da geração da migration — restaurar no Step 5
export * from './relations';
```

- [ ] **Step 3: Gerar a migration e conferir o SQL**

Run: `pnpm db:generate`
Run: `cat packages/db/drizzle/00*.sql | tail -n +1 | grep -n "first_contact_at\|bio_rate_limit\|DROP"` — ou abrir o `.sql` recém-criado.
Expected: o novo `.sql` contém **apenas** `ALTER TABLE "leads" ADD COLUMN "first_contact_at" timestamp with time zone;`. **Nenhuma** referência a `bio_rate_limit`, **nenhum** `DROP`. Se aparecer qualquer outra coisa, PARAR e revisar.

- [ ] **Step 4: Aplicar a migration**

Run: `pnpm db:migrate`
Expected: `migrations applied successfully!` (coluna nullable aditiva — segura).

- [ ] **Step 5: Restaurar o export do bio**

Em `packages/db/src/schema/index.ts`, voltar a linha ao original (sem comentário):

```ts
export * from './bio-rate-limit';
export * from './relations';
```

Run: `git diff packages/db/src/schema/index.ts`
Expected: vazio (arquivo idêntico ao estado anterior — o export do bio permanece como estava no working tree, intocado).

- [ ] **Step 6: Commit (somente schema + migration — NÃO commitar o index nem arquivos bio)**

```bash
git add packages/db/src/schema/leads.ts packages/db/drizzle/
git commit --author="Rodrigo Albuquerque <rodrigo@benitesalbuquerque.com.br>" -m "feat(db): coluna first_contact_at em leads (nullable)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

Run depois do commit: `git show HEAD --name-only | grep -i "bio\|index.ts"` — Expected: nada (confirma que o trabalho bio ficou fora).

---

## Task 4: Gravar `first_contact_at` na transição de estágio

**Files:**
- Modify: `apps/crm/src/server/actions/leads.ts`

- [ ] **Step 1: Importar o predicado**

No topo de `apps/crm/src/server/actions/leads.ts`, adicionar o import (junto aos imports existentes de `@/server/lib/...`):

```ts
import { reachesFirstContact } from '@/server/lib/first-contact-urgency';
```

- [ ] **Step 2: Trazer `firstContactAt` no select do lead**

Em `updateLeadStageAction`, no `.select({...})` que carrega o lead (campos `id`, `stageId`, `updatedAt`), adicionar `firstContactAt`:

```ts
  const [lead] = await db
    .select({
      id: schema.leads.id,
      stageId: schema.leads.stageId,
      updatedAt: schema.leads.updatedAt,
      firstContactAt: schema.leads.firstContactAt,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), isNull(schema.leads.deletedAt)))
    .limit(1);
```

- [ ] **Step 3: Gravar o timestamp na transição (set-once)**

No `tx.update(schema.leads).set({...})` dentro da transação, adicionar a linha `firstContactAt` (grava só se ainda for null E a transição alcança o primeiro contato):

```ts
    await tx
      .update(schema.leads)
      .set({
        stageId: input.targetStageId,
        motivoPerdaId: input.motivoPerdaId ?? undefined,
        valorProposto: input.valorProposto ?? undefined,
        formaPagamentoNegociada: input.formaPagamentoNegociada ?? undefined,
        firstContactAt:
          lead.firstContactAt == null && reachesFirstContact(targetStage.slug)
            ? now
            : undefined,
        updatedAt: now,
      })
      .where(eq(schema.leads.id, input.leadId));
```

(`undefined` = não altera a coluna; o set-once preserva o primeiro contato mesmo se o lead voltar ao pré-contato e avançar de novo.)

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: 0 erros. (`targetStage.slug` já existe no escopo; `lead.firstContactAt` é `Date | null`.)

- [ ] **Step 5: Commit**

```bash
git add apps/crm/src/server/actions/leads.ts
git commit --author="Rodrigo Albuquerque <rodrigo@benitesalbuquerque.com.br>" -m "feat(crm): grava first_contact_at ao sair do pré-contato

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Backfill de `first_contact_at` a partir do histórico

Leads que já passaram pelo caminho de contato (ex: Rodrigo, em `meeting_done`) têm o momento real registrado em `lead_stage_history`. Backfill = `MIN(changed_at)` das transições para estágios do caminho de contato.

**Files:**
- Create: `apps/crm/scripts/backfill-first-contact-at.ts`
- Modify: `apps/crm/package.json`

- [ ] **Step 1: Criar o script**

Create `apps/crm/scripts/backfill-first-contact-at.ts`:

```ts
#!/usr/bin/env tsx
/**
 * Backfill de `leads.first_contact_at`.
 *
 * Para leads que já saíram do pré-contato ANTES do código que grava o
 * timestamp existir, reconstrói o momento do primeiro contato a partir de
 * `lead_stage_history` (append-only, fonte de verdade): o MIN(changed_at)
 * das transições para um estágio do caminho de contato (first_contact_sent
 * em diante, exceto lost).
 *
 * Idempotente: guard `first_contact_at IS NULL`. Reversível: UPDATE ... = NULL.
 *
 * Uso: pnpm --filter crm backfill-first-contact-at
 */

import { sql } from 'drizzle-orm';
import { db } from '@repo/db/client';

async function run() {
  const before = await db.execute(sql`
    SELECT count(*)::int AS n
    FROM leads l
    WHERE l.first_contact_at IS NULL
      AND l.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM lead_stage_history h
        JOIN lead_stages s ON s.id = h.to_stage_id
        WHERE h.lead_id = l.id
          AND s.slug IN ('first_contact_sent','meeting_scheduled','meeting_done',
                         'proposal_sent','closed_verbally','contract_sent','paid')
      )
  `);
  const pending = (before as unknown as { n: number }[])[0]?.n ?? 0;
  console.log(`Leads sem first_contact_at mas com histórico de contato: ${pending}`);

  if (pending === 0) {
    console.log('Nada a backfillar. Saindo.');
    process.exit(0);
  }

  const updated = await db.execute(sql`
    UPDATE leads l
    SET first_contact_at = sub.first_at
    FROM (
      SELECT h.lead_id, MIN(h.changed_at) AS first_at
      FROM lead_stage_history h
      JOIN lead_stages s ON s.id = h.to_stage_id
      WHERE s.slug IN ('first_contact_sent','meeting_scheduled','meeting_done',
                       'proposal_sent','closed_verbally','contract_sent','paid')
      GROUP BY h.lead_id
    ) sub
    WHERE l.id = sub.lead_id AND l.first_contact_at IS NULL AND l.deleted_at IS NULL
    RETURNING l.id, coalesce(l.nickname, l.name) AS nome, l.first_contact_at
  `);

  const rows = updated as unknown as { nome: string; first_contact_at: string }[];
  console.log(`\n✓ ${rows.length} lead(s) backfillado(s):`);
  for (const r of rows) {
    console.log(`  - ${r.nome} (${new Date(r.first_contact_at).toISOString()})`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Falha no backfill:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Adicionar o script ao package.json**

Em `apps/crm/package.json`, na seção `"scripts"`, após a linha `backfill-application-received-at`:

```json
    "backfill-application-received-at": "tsx --env-file=.env.local scripts/backfill-application-received-at.ts",
    "backfill-first-contact-at": "tsx --env-file=.env.local scripts/backfill-first-contact-at.ts"
```

- [ ] **Step 3: Rodar o backfill (escrita em produção — aditiva, idempotente)**

Run: `pnpm --filter crm backfill-first-contact-at`
Expected: imprime a contagem e os leads atualizados (ex: Rodrigo). Se já estiver tudo preenchido, imprime "Nada a backfillar".

- [ ] **Step 4: Commit**

```bash
git add apps/crm/scripts/backfill-first-contact-at.ts apps/crm/package.json
git commit --author="Rodrigo Albuquerque <rodrigo@benitesalbuquerque.com.br>" -m "chore(crm): backfill first_contact_at a partir do histórico de estágios

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Query + card no dashboard

**Files:**
- Modify: `apps/crm/src/server/queries/dashboard.ts`
- Modify: `apps/crm/src/app/(crm)/dashboard/page.tsx`

- [ ] **Step 1: Adicionar a query**

Em `apps/crm/src/server/queries/dashboard.ts`, garantir que os helpers `and`, `isNull`, `isNotNull` estão importados de `drizzle-orm` (adicionar os que faltarem à linha de import existente). Depois adicionar a função (no fim do arquivo, junto às outras queries):

```ts
/**
 * Pares (aplicação, primeiro contato) dos leads que já tiveram primeiro
 * contato e têm timestamp de aplicação. Base da métrica "tempo até 1º contato".
 * Legados sem application_received_at ficam de fora (sem início confiável).
 */
export async function getTimeToFirstContact() {
  return db
    .select({
      applicationReceivedAt: schema.leads.applicationReceivedAt,
      firstContactAt: schema.leads.firstContactAt,
    })
    .from(schema.leads)
    .where(
      and(
        isNull(schema.leads.deletedAt),
        isNotNull(schema.leads.applicationReceivedAt),
        isNotNull(schema.leads.firstContactAt),
      ),
    );
}
```

- [ ] **Step 2: Verificar imports no dashboard.ts**

Run: `grep -n "import.*drizzle-orm" apps/crm/src/server/queries/dashboard.ts`
Garantir que `and`, `isNull`, `isNotNull` constam. Se algum faltar, acrescentar ao destructuring do import existente de `drizzle-orm`.

- [ ] **Step 3: Computar a métrica na página**

Em `apps/crm/src/app/(crm)/dashboard/page.tsx`:

3a. Adicionar os imports (junto aos imports de queries e libs):

```ts
import { getTimeToFirstContact } from '@/server/queries/dashboard';
import { computeFirstContactMetric } from '@/server/lib/first-contact-metric';
```

(Se `getTimeToFirstContact` puder ser adicionado ao import já existente de `@/server/queries/dashboard`, fazê-lo lá em vez de uma linha nova.)

3b. Incluir a query no `Promise.all` que busca os dados do dashboard. Localizar o array de queries e adicionar `getTimeToFirstContact()`, capturando o resultado (ex: `ttfcRows`) na desestruturação correspondente.

3c. Logo após o bloco de `Promise.all`, computar:

```ts
  const ttfcDurations = ttfcRows.map(
    (r) => (r.firstContactAt!.getTime() - r.applicationReceivedAt!.getTime()) / 1000,
  );
  const ttfc = computeFirstContactMetric(ttfcDurations);
```

- [ ] **Step 4: Renderizar o card e abrir espaço no grid**

No grid hero (`<div className="grid grid-cols-5 gap-4">`, ~linha 222), trocar `grid-cols-5` por `grid-cols-6` e adicionar o card como **último** filho, depois do card "taxa de conversão":

```tsx
          <KpiCard
            label="tempo até 1º contato"
            value={ttfc.medianSeconds !== null ? formatDuration(ttfc.medianSeconds) : '—'}
            note={
              ttfc.count > 0
                ? `mediana · ${ttfc.withinSlaPct}% em 24h · base ${ttfc.count}`
                : 'sem dados ainda'
            }
            highlight={
              ttfc.withinSlaPct !== null && ttfc.withinSlaPct < 50 ? 'warn' : undefined
            }
          />
```

(`formatDuration` já existe no arquivo e aceita segundos.)

- [ ] **Step 5: Typecheck + testes**

Run: `pnpm typecheck`
Expected: 0 erros.
Run: `pnpm --filter crm test`
Expected: tudo verde (inclui os 13 novos testes das Tasks 1–2), 0 falhas.

- [ ] **Step 6: Verificação manual**

Run: `pnpm --filter crm dev` → abrir `/dashboard`.
Expected: o card "tempo até 1º contato" aparece no grid hero, mostrando a mediana (ex: após backfill, ao menos o Rodrigo entra na base) + `% em 24h · base N`. Leads ainda em pré-contato não contam.

- [ ] **Step 7: Commit**

```bash
git add apps/crm/src/server/queries/dashboard.ts "apps/crm/src/app/(crm)/dashboard/page.tsx"
git commit --author="Rodrigo Albuquerque <rodrigo@benitesalbuquerque.com.br>" -m "feat(crm): card 'tempo até 1º contato' no dashboard (mediana + % SLA)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Documentação

**Files:**
- Modify: `apps/crm/CLAUDE.md`
- Modify: `CLAUDE.md` (raiz)

- [ ] **Step 1: Deep module novo em `apps/crm/CLAUDE.md`**

Na tabela "Deep modules", adicionar:

```markdown
| `server/lib/first-contact-metric/` | Puro | 7 passando |
```

- [ ] **Step 2: Decisão no `CLAUDE.md` raiz**

Na seção "Decisões arquiteturais importantes", após o bullet do sinal de primeiro contato, adicionar:

```markdown
- **Tempo até o 1º contato (métrica de SDR)** — `leads.first_contact_at` (coluna nullable) grava o **primeiro** momento em que o lead sai do pré-contato para o caminho de contato (`first_contact_sent`+, exceto `lost`), via `updateLeadStageAction` na mesma transação do `writeStageHistory`, com guard set-once. Predicado puro `reachesFirstContact` em `server/lib/first-contact-urgency`. Métrica do dashboard "tempo até 1º contato" = `first_contact_at − application_received_at`, agregada por `server/lib/first-contact-metric` (mediana + % no SLA de 24h; mediana porque a distribuição é torta). Legados sem `application_received_at` ficam fora (sem início confiável). Backfill histórico via `pnpm --filter crm backfill-first-contact-at` (reconstrói de `lead_stage_history`).
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md apps/crm/CLAUDE.md
git commit --author="Rodrigo Albuquerque <rodrigo@benitesalbuquerque.com.br>" -m "docs: registra métrica tempo até 1º contato

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Critério de pronto

1. `pnpm typecheck` → 0 erros.
2. `pnpm --filter crm test` → tudo verde (13 testes novos), 0 falhas.
3. Mover um lead de pré-contato para `first_contact_sent` (ou pular pra reunião) grava `first_contact_at` uma vez; mover para `lost` não grava; mover de novo não sobrescreve.
4. Backfill preenche `first_contact_at` dos leads históricos a partir de `lead_stage_history`.
5. Dashboard mostra o card "tempo até 1º contato" com mediana + % em 24h + base N.
6. Migration `first_contact_at` aplicada sem arrastar `bio_rate_limit`.
