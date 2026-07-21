'use server';

// Ponte de receita (ação owner-only) — a lógica de fato mora em
// server/lib/revenue-bridge-sync (compartilhada com o cron, que não tem
// sessão de usuário pra passar por requireAuth).

import { revalidatePath } from 'next/cache';
import { requireAuth, requireRole } from '@/server/auth';
import { runRevenueBridgeSync, type RevenueBridgeSyncResult } from '@/server/lib/revenue-bridge-sync/index';
import type { ActionResult } from './leads';

export async function syncRevenueBridgeAction(): Promise<ActionResult<RevenueBridgeSyncResult>> {
  const auth = await requireAuth();
  requireRole(auth, 'owner');

  const result = await runRevenueBridgeSync(auth.userId);
  if ('error' in result) return { ok: false, error: result.error };

  revalidatePath('/financeiro');
  revalidatePath('/financeiro/dre');
  revalidatePath('/financeiro/fluxo');

  return { ok: true, data: result };
}
