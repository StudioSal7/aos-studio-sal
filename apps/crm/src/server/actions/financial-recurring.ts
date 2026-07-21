'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { requireAuth, requireRole } from '@/server/auth';
import type { ActionResult } from './leads';

const RECURRING_PATH = '/financeiro/recorrencias';

async function requireOwner() {
  const auth = await requireAuth();
  requireRole(auth, 'owner');
  return auth;
}

export async function createFinancialRecurringTemplateAction(input: {
  kind: 'receita' | 'despesa';
  description: string;
  amountCents: number;
  categoryId: string;
  accountId: string | null;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
}): Promise<ActionResult> {
  await requireOwner();
  const description = input.description.trim();
  if (!description) return { ok: false, error: 'Descrição obrigatória.' };
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: 'Valor precisa ser maior que zero.' };
  }
  if (input.dayOfMonth < 1 || input.dayOfMonth > 31) {
    return { ok: false, error: 'Dia do vencimento precisa ser entre 1 e 31.' };
  }

  await db.insert(schema.financialRecurringTemplates).values({
    kind: input.kind,
    description,
    amountCents: input.amountCents,
    categoryId: input.categoryId,
    accountId: input.accountId,
    dayOfMonth: input.dayOfMonth,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  revalidatePath(RECURRING_PATH);
  return { ok: true };
}

export async function toggleFinancialRecurringTemplateActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireOwner();
  await db
    .update(schema.financialRecurringTemplates)
    .set({ active, updatedAt: new Date() })
    .where(eq(schema.financialRecurringTemplates.id, id));

  revalidatePath(RECURRING_PATH);
  return { ok: true };
}
