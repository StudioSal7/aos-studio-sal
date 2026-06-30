#!/usr/bin/env tsx
/**
 * Backfill pontual de `leads.application_received_at`.
 *
 * Contexto: a coluna `application_received_at` é preenchida no momento da
 * entrada ao vivo (formulário / webhook Respondi). Mas os leads que já tinham
 * entrado pelo formulário ANTES desse código existir ficaram com a coluna null,
 * mesmo tendo data de cadastro real em `created_at`.
 *
 * Este script preenche `application_received_at = created_at` SOMENTE para os
 * leads cuja origem de intake é `formulario_web` (cadastro real, `created_at`
 * é a data verdadeira da aplicação). Leads de `legacy_csv_import` ficam null
 * de propósito — o `created_at` deles é histórico (jul/2025–mai/2026) e
 * acenderia "atrasado" em massa.
 *
 * Idempotente: o guard `application_received_at IS NULL` torna re-execuções
 * inofensivas (não sobrescreve nada já preenchido).
 *
 * Reversível: para desfazer, `UPDATE leads SET application_received_at = NULL
 * WHERE id IN (SELECT lead_id FROM lead_intake_log WHERE source='formulario_web')`.
 *
 * Uso: pnpm --filter crm backfill-application-received-at
 */

import { sql } from 'drizzle-orm';
import { db } from '@repo/db/client';

async function run() {
  // Pré-contagem: quantos leads formulario_web ainda estão sem o timestamp.
  const before = await db.execute(sql`
    SELECT count(*)::int AS n
    FROM leads
    WHERE application_received_at IS NULL
      AND id IN (SELECT lead_id FROM lead_intake_log WHERE source = 'formulario_web')
  `);
  const pending = (before as unknown as { n: number }[])[0]?.n ?? 0;
  console.log(`Leads formulario_web sem application_received_at: ${pending}`);

  if (pending === 0) {
    console.log('Nada a preencher — já está tudo backfillado. Saindo.');
    process.exit(0);
  }

  // Backfill cirúrgico: só formulario_web, só onde está null.
  const updated = await db.execute(sql`
    UPDATE leads
    SET application_received_at = created_at
    WHERE application_received_at IS NULL
      AND id IN (SELECT lead_id FROM lead_intake_log WHERE source = 'formulario_web')
    RETURNING id, coalesce(nickname, name) AS nome, created_at
  `);

  const rows = updated as unknown as { nome: string; created_at: string }[];
  console.log(`\n✓ ${rows.length} lead(s) atualizado(s):`);
  for (const r of rows) {
    console.log(`  - ${r.nome} (${new Date(r.created_at).toISOString()})`);
  }

  // O @repo/db/client não expõe client.end() — encerrar explicitamente.
  process.exit(0);
}

run().catch((err) => {
  console.error('Falha no backfill:', err);
  process.exit(1);
});
