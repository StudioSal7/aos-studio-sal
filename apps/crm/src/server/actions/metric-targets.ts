'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { requireAuth } from '@/server/auth';
import { isMetricKey, metricByKey } from '@/server/lib/metric-registry/index';
import type { ActionResult } from './leads';

// Metas do dashboard (owner only). O catálogo de chaves vive no
// metric-registry (código) — impossível criar meta órfã. `numeric` no Drizzle
// trafega como string: String() ao gravar, Number() ao ler (queries).

function validateTargetInput(input: {
  metricKey: string;
  comparator: 'gte' | 'lte';
  threshold: number;
  yellowMargin: number;
}): string | null {
  if (!isMetricKey(input.metricKey)) return 'métrica desconhecida';
  if (input.comparator !== 'gte' && input.comparator !== 'lte') return 'comparador inválido';
  if (!Number.isFinite(input.threshold) || input.threshold < 0) {
    return 'meta precisa ser um número maior ou igual a zero';
  }
  if (!Number.isFinite(input.yellowMargin) || input.yellowMargin < 0) {
    return 'margem precisa ser um número maior ou igual a zero';
  }
  if (metricByKey(input.metricKey)?.unit === 'pct' && input.threshold > 100) {
    return 'meta em % não pode passar de 100';
  }
  return null;
}

export async function upsertMetricTargetAction(input: {
  metricKey: string;
  comparator: 'gte' | 'lte';
  threshold: number;
  yellowMargin: number;
}): Promise<ActionResult> {
  const auth = await requireAuth();
  if (auth.role !== 'owner') return { ok: false, error: 'forbidden' };

  const validationError = validateTargetInput(input);
  if (validationError) return { ok: false, error: validationError };

  await db
    .insert(schema.metricTargets)
    .values({
      metricKey: input.metricKey,
      comparator: input.comparator,
      threshold: String(input.threshold),
      yellowMargin: String(input.yellowMargin),
    })
    .onConflictDoUpdate({
      target: schema.metricTargets.metricKey,
      set: {
        comparator: input.comparator,
        threshold: String(input.threshold),
        yellowMargin: String(input.yellowMargin),
        updatedAt: new Date(),
      },
    });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { ok: true };
}

// Deletar a linha = remover a meta (métrica volta a cinza no dashboard).
// Sem soft-delete de propósito: um único caminho para "sem meta".
export async function deleteMetricTargetAction(metricKey: string): Promise<ActionResult> {
  const auth = await requireAuth();
  if (auth.role !== 'owner') return { ok: false, error: 'forbidden' };
  if (!isMetricKey(metricKey)) return { ok: false, error: 'métrica desconhecida' };

  await db.delete(schema.metricTargets).where(eq(schema.metricTargets.metricKey, metricKey));

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { ok: true };
}
