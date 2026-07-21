/**
 * Cron: financial-revenue-sync (diário às 08:00 SP = 11:00 UTC)
 *
 * Roda a ponte de receita: cria lançamentos financeiros a partir de vendas
 * Hotmart aprovadas e leads em estágio `paid`. Idempotente — pode rodar
 * quantas vezes for, nunca duplica (índice único parcial por origem).
 *
 * Auth: CRON_SECRET header injetado pelo Vercel.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { runRevenueBridgeSync } from '@/server/lib/revenue-bridge-sync/index';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runRevenueBridgeSync(null);
  if ('error' in result) {
    console.error('[financial-revenue-sync] falhou:', result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  console.log('[financial-revenue-sync] cron rodou', new Date().toISOString(), result);
  return NextResponse.json({ ok: true, ...result });
}
