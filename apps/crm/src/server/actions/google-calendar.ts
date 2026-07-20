'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { requireAuth, requireRole } from '@/server/auth';
import type { ActionResult } from '@/server/actions/leads';
import {
  getActiveAccountWithToken,
  groupEventsByDay,
  listWeekEvents,
  MAX_WEEK_OFFSET,
  revokeToken,
  weekWindowAtOffset,
  type AgendaDay,
} from '@/server/lib/google-calendar';

// ---- Agenda da semana (qualquer usuário autenticado visualiza) ----

export type WeekAgendaData =
  | { connected: true; accountEmail: string; weekLabel: string; days: AgendaDay[] }
  | { connected: false; reason: 'not_connected' | 'invalid_grant' | 'google_error' };

export async function getGoogleWeekAgendaAction(input: {
  weekOffset: number;
}): Promise<ActionResult<WeekAgendaData>> {
  await requireAuth();

  const offset = Math.min(Math.max(Math.trunc(input.weekOffset) || 0, 0), MAX_WEEK_OFFSET);
  const window = weekWindowAtOffset(offset);

  const active = await getActiveAccountWithToken();
  if (!active.ok) {
    const reason = active.reason === 'refresh_failed' ? 'google_error' : active.reason;
    return { ok: true, data: { connected: false, reason } };
  }

  try {
    const events = await listWeekEvents(
      active.accessToken,
      window.fromUtc.toISOString(),
      window.toUtc.toISOString(),
    );
    return {
      ok: true,
      data: {
        connected: true,
        accountEmail: active.account.googleEmail,
        weekLabel: window.label,
        days: groupEventsByDay(events, window),
      },
    };
  } catch {
    // Nunca vazar detalhe do erro Google (pode conter contexto sensível).
    return { ok: true, data: { connected: false, reason: 'google_error' } };
  }
}

// ---- Desconectar conta (owner only) ----

export async function disconnectGoogleAccountAction(input: {
  accountId: string;
}): Promise<ActionResult> {
  const auth = await requireAuth();
  requireRole(auth, 'owner');

  const [account] = await db
    .select({
      id: schema.googleAccounts.id,
      refreshToken: schema.googleAccounts.refreshToken,
    })
    .from(schema.googleAccounts)
    .where(eq(schema.googleAccounts.id, input.accountId))
    .limit(1);

  if (!account) return { ok: false, error: 'account_not_found' };

  if (account.refreshToken) {
    // Best-effort: revogar junto ao Google; falha não impede o disconnect local.
    await revokeToken(account.refreshToken).catch(() => {});
  }

  // Linha fica (histórico + FK das meetings); tokens anulados.
  await db
    .update(schema.googleAccounts)
    .set({
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      isActive: false,
      lastSyncError: 'disconnected',
      updatedAt: new Date(),
    })
    .where(eq(schema.googleAccounts.id, account.id));

  revalidatePath('/admin');
  return { ok: true };
}
