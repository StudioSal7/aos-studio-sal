/**
 * Cron: meta-sync (diário 06:00 SP = 09:00 UTC)
 *
 * Re-upserta a janela D-7 → D-1 de insights Meta Ads (grão dia × anúncio).
 * Reescrever os últimos 7 dias todo dia resolve a reatribuição retroativa da
 * Meta por construção — o dado "assenta" antes da decisão (fechada em D-3).
 *
 * Auth: CRON_SECRET header injetado pela Vercel.
 * Requer META_ACCESS_TOKEN + META_AD_ACCOUNT_ID (falha vira meta_sync_runs
 * status=error, visível no banner do /trafego).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { dayInSaoPaulo } from '@/server/lib/ads-windows/index';
import { RESYNC_WINDOW_DAYS, runMetaSync } from '@/server/lib/meta-sync/index';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const since = dayInSaoPaulo(now, -RESYNC_WINDOW_DAYS);
  const until = dayInSaoPaulo(now, -1);

  const result = await runMetaSync({ since, until, trigger: 'cron' });

  console.warn(
    `[meta-sync] ${result.status} — janela ${since}→${until}, ${result.rowsUpserted} linhas${result.error ? ` — ${result.error}` : ''}`,
  );

  return NextResponse.json({
    ok: result.status === 'ok',
    runId: result.runId,
    rowsUpserted: result.rowsUpserted,
    since,
    until,
    ...(result.error ? { error: result.error } : {}),
  });
}
