#!/usr/bin/env tsx
/**
 * Backfill histórico de insights Meta Ads (grão dia × anúncio).
 *
 * Percorre [--since, --until] em janelas de 30 dias, sequencialmente, pela
 * MESMA função de upsert do cron (runMetaSync) — idempotente, re-rodar não
 * duplica. A Meta guarda ~37 meses de insights.
 *
 * Usage:
 *   pnpm --filter crm meta-backfill -- --since=2026-02-01
 *   pnpm --filter crm meta-backfill -- --since=2026-02-01 --until=2026-06-30
 *   pnpm --filter crm meta-backfill -- --since=2026-02-01 --dry-run
 *
 * --until default: D-1 (ontem em America/Sao_Paulo).
 * Falha em alguma janela → exit 1; resumível re-rodando com --since na janela
 * que falhou (o resto já gravado é re-upsertado sem efeito).
 *
 * Requer META_ACCESS_TOKEN, META_AD_ACCOUNT_ID e DATABASE_URL (via
 * tsx --env-file=.env.local). Migration 0017 precisa estar aplicada.
 */

import { backfillWindows, runMetaSync } from '../src/server/lib/meta-sync/index';

const args = process.argv.slice(2).filter((a) => a !== '--');
const since = args.find((a) => a.startsWith('--since='))?.split('=')[1];
const untilArg = args.find((a) => a.startsWith('--until='))?.split('=')[1];
const dryRun = args.includes('--dry-run');

if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
  console.error('Usage: pnpm --filter crm meta-backfill -- --since=YYYY-MM-DD [--until=YYYY-MM-DD] [--dry-run]');
  process.exit(1);
}

function spDay(offsetDays: number): string {
  // America/Sao_Paulo = UTC-3 fixo (sem DST desde 2019)
  return new Date(Date.now() - 3 * 3600 * 1000 + offsetDays * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
}

const until = untilArg ?? spDay(-1);

async function main() {
  const windows = backfillWindows(since!, until);
  if (windows.length === 0) {
    console.error(`Janela inválida: ${since} → ${until}`);
    process.exit(1);
  }

  console.log(`📥 Backfill Meta Ads: ${since} → ${until} (${windows.length} janela(s) de até 30 dias)`);

  if (dryRun) {
    for (const w of windows) console.log(`   [dry-run] ${w.since} → ${w.until}`);
    console.log('Nada executado (--dry-run).');
    process.exit(0);
  }

  let totalRows = 0;
  let failures = 0;

  for (const [i, w] of windows.entries()) {
    process.stdout.write(`   [${i + 1}/${windows.length}] ${w.since} → ${w.until} ... `);
    const result = await runMetaSync({ since: w.since, until: w.until, trigger: 'backfill' });

    if (result.status === 'ok') {
      totalRows += result.rowsUpserted;
      console.log(`ok (${result.rowsUpserted} linhas)`);
    } else {
      failures++;
      console.log(`ERRO: ${result.error}`);
    }
  }

  console.log(`\n${failures === 0 ? '✅' : '⚠️'} Backfill: ${totalRows} linhas upsertadas, ${failures} janela(s) com erro.`);
  if (failures > 0) {
    console.log('   Re-rode com --since apontando pra primeira janela que falhou (upsert é idempotente).');
  }
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Backfill falhou:', err);
  process.exit(1);
});
