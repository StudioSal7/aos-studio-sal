/**
 * Cron: sla-check (daily at 08:00 SP = 11:00 UTC)
 *
 * Phase 1: idle — no SLA rules configured yet.
 * Logs the run so the cron is operational when rules are added in Phase 1.5+.
 *
 * Auth: CRON_SECRET header injected by Vercel.
 */

import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Idle in Phase 1. SLA rules will be implemented in Phase 1.5 when the client
  // has enough historical data to define appropriate idle thresholds.
  console.log('[sla-check] cron ran at', new Date().toISOString(), '— idle (no SLA rules)');

  return NextResponse.json({ ok: true, message: 'idle — no SLA rules configured' });
}
