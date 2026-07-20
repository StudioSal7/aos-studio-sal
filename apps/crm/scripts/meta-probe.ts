#!/usr/bin/env tsx
/**
 * Sondagem de payload da Meta Graph API — RODAR ANTES de confiar no mapper.
 *
 * Faz UMA chamada de insights (level=ad, time_increment=1, 1 dia) e valida os
 * nomes de campo que o mapper assume contra a versão corrente da API:
 *   (a) inline_link_clicks presente? (senão o fallback actions[link_click] assume)
 *   (b) actions[landing_page_view] presente? (nó do connect rate)
 *   (c) actions[video_view] presente? (fonte do video_3s / hook)
 *   (d) quais action_types de COMPRA aparecem (precedência fb_pixel → purchase → omni)
 *   (e) date_start === date_stop (grão diário)
 *
 * Usage:
 *   pnpm --filter crm meta-probe            # sonda D-2
 *   pnpm --filter crm meta-probe -- --date=2026-07-10
 *
 * Requer META_ACCESS_TOKEN e META_AD_ACCOUNT_ID em apps/crm/.env.local.
 * Read-only: nenhuma escrita em banco nem na Meta.
 */

import { AD_INSIGHT_FIELDS, fetchAdInsights, META_API_VERSION } from '../src/server/lib/meta-client/index';
import { PURCHASE_PRECEDENCE } from '../src/server/lib/meta-insights-mapper/index';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dateArg = args.find((a) => a.startsWith('--date='))?.split('=')[1];

function spDay(offsetDays: number): string {
  // America/Sao_Paulo = UTC-3 fixo (sem DST desde 2019)
  const now = new Date(Date.now() - 3 * 3600 * 1000 + offsetDays * 24 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

const day = dateArg ?? spDay(-2);

async function main() {
  console.log(`🔍 Sondagem Meta Graph ${META_API_VERSION} — level=ad, dia ${day}`);
  console.log(`   fields: ${AD_INSIGHT_FIELDS.join(',')}\n`);

  const rows = await fetchAdInsights({ since: day, until: day });

  console.log(`Linhas retornadas: ${rows.length}`);
  if (rows.length === 0) {
    console.log('⚠️  Nenhuma linha nesse dia (conta sem entrega?). Tente outro --date=.');
    process.exit(0);
  }

  const actionTypes = new Set<string>();
  const valueTypes = new Set<string>();
  for (const r of rows) {
    for (const a of r.actions ?? []) actionTypes.add(a.action_type);
    for (const a of r.action_values ?? []) valueTypes.add(a.action_type);
  }

  console.log('\n— Primeira linha (crua) —');
  console.log(JSON.stringify(rows[0], null, 2));

  console.log('\n— action_types distintos em `actions` —');
  console.log([...actionTypes].sort().join('\n') || '(vazio)');
  console.log('\n— action_types distintos em `action_values` —');
  console.log([...valueTypes].sort().join('\n') || '(vazio)');

  const hasInlineLinkClicks = rows.some((r) => r.inline_link_clicks !== undefined);
  const purchaseTypesFound = PURCHASE_PRECEDENCE.filter((t) => actionTypes.has(t));

  const checks: Array<[string, boolean, string]> = [
    ['(a) inline_link_clicks no payload', hasInlineLinkClicks, 'fallback actions[link_click] assume'],
    ['(a2) actions[link_click] presente', actionTypes.has('link_click'), ''],
    ['(b) actions[landing_page_view] presente', actionTypes.has('landing_page_view'), 'connect rate fica sem fonte!'],
    ['(c) actions[video_view] presente', actionTypes.has('video_view'), 'video_3s/hook ficam sem fonte!'],
    [
      `(d) compra via precedência (achou: ${purchaseTypesFound.join(', ') || 'nenhum'})`,
      purchaseTypesFound.length > 0,
      'sem type de compra — conferir evento do pixel',
    ],
    ['(e) grão diário (date_start === date_stop)', rows.every((r) => r.date_start === r.date_stop), ''],
  ];

  console.log('\n— Checks do mapper —');
  let failed = false;
  for (const [label, ok, warn] of checks) {
    console.log(`${ok ? '✅' : '❌'} ${label}${!ok && warn ? ` — ${warn}` : ''}`);
    if (!ok) failed = true;
  }

  console.log(
    failed
      ? '\n⚠️  Algum check falhou — ajustar o mapper ANTES do backfill.'
      : '\n✅ Payload compatível com o mapper.',
  );
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('Sondagem falhou:', err instanceof Error ? err.message : err);
  process.exit(1);
});
