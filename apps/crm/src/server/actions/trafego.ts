'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { requireAuth, requireRole } from '@/server/auth';
import type { ActionResult } from './leads';

// Form de 20 segundos: anota mudança na conta de anúncios (budget, pausa,
// criativo novo...) na timeline — sem isso, curva quebrada é ininterpretável.
// Qualquer papel cria (log operacional, como nota); só owner deleta.

const eventSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data inválida'),
  level: z.enum(['account', 'campaign', 'adset', 'ad']),
  entityId: z.string().trim().max(64).optional(),
  eventType: z.enum(['budget', 'pause', 'resume', 'creative_edit', 'launch', 'other']),
  note: z.string().trim().min(1, 'nota obrigatória').max(500),
});

export type AccountEventInput = z.infer<typeof eventSchema>;

export async function createAccountEventAction(
  input: AccountEventInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAuth();

  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'entrada inválida' };
  }

  const [created] = await db
    .insert(schema.metaAccountEvents)
    .values({
      eventDate: parsed.data.eventDate,
      level: parsed.data.level,
      entityId: parsed.data.entityId || null,
      eventType: parsed.data.eventType,
      note: parsed.data.note,
      createdBy: auth.email,
    })
    .returning({ id: schema.metaAccountEvents.id });

  if (!created) return { ok: false, error: 'falha ao gravar o evento' };

  revalidatePath('/trafego');
  return { ok: true, data: { id: created.id } };
}

export async function deleteAccountEventAction(id: string): Promise<ActionResult> {
  const auth = await requireAuth();
  requireRole(auth, 'owner');

  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: 'id inválido' };
  }

  await db.delete(schema.metaAccountEvents).where(eq(schema.metaAccountEvents.id, id));

  revalidatePath('/trafego');
  return { ok: true };
}
