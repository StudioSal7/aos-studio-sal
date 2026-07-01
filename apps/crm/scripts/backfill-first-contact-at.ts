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
