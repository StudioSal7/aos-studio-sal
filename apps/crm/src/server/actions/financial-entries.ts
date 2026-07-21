'use server';

// Server actions dos lançamentos financeiros. Owner-only.
// Edição livre só é permitida em lançamentos manuais — os de origem
// hotmart_sale/lead_paid/recurring são geridos pelas rotinas automáticas
// (Fatia 8), então só podem ser liquidados/cancelados, não reescritos.

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { requireAuth, requireRole } from '@/server/auth';
import type { ActionResult } from './leads';

const FINANCEIRO_PATH = '/financeiro';

async function requireOwner() {
  const auth = await requireAuth();
  requireRole(auth, 'owner');
  return auth;
}

export async function createFinancialEntryAction(input: {
  kind: 'receita' | 'despesa';
  description: string;
  amountCents: number;
  competenceDate: string; // YYYY-MM-DD
  dueDate: string | null;
  categoryId: string;
  accountId: string | null;
  notes: string | null;
}): Promise<ActionResult> {
  const auth = await requireOwner();
  const description = input.description.trim();
  if (!description) return { ok: false, error: 'Descrição obrigatória.' };
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: 'Valor precisa ser maior que zero.' };
  }
  if (!input.competenceDate) return { ok: false, error: 'Data de competência obrigatória.' };

  await db.insert(schema.financialEntries).values({
    kind: input.kind,
    description,
    amountCents: input.amountCents,
    competenceDate: input.competenceDate,
    dueDate: input.dueDate,
    categoryId: input.categoryId,
    accountId: input.accountId,
    originSource: 'manual',
    notes: input.notes,
    createdBy: auth.userId,
    status: 'em_aberto',
  });

  revalidatePath(FINANCEIRO_PATH);
  return { ok: true };
}

export async function updateFinancialEntryAction(
  id: string,
  input: {
    description: string;
    amountCents: number;
    competenceDate: string;
    dueDate: string | null;
    categoryId: string;
    notes: string | null;
  },
): Promise<ActionResult> {
  await requireOwner();

  const [existing] = await db
    .select({ originSource: schema.financialEntries.originSource })
    .from(schema.financialEntries)
    .where(eq(schema.financialEntries.id, id))
    .limit(1);
  if (!existing) return { ok: false, error: 'Lançamento não encontrado.' };
  if (existing.originSource !== 'manual') {
    return { ok: false, error: 'Este lançamento é automático — só pode ser liquidado ou cancelado.' };
  }

  const description = input.description.trim();
  if (!description) return { ok: false, error: 'Descrição obrigatória.' };
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: 'Valor precisa ser maior que zero.' };
  }

  await db
    .update(schema.financialEntries)
    .set({
      description,
      amountCents: input.amountCents,
      competenceDate: input.competenceDate,
      dueDate: input.dueDate,
      categoryId: input.categoryId,
      notes: input.notes,
      updatedAt: new Date(),
    })
    .where(eq(schema.financialEntries.id, id));

  revalidatePath(FINANCEIRO_PATH);
  return { ok: true };
}

export async function liquidateFinancialEntryAction(input: {
  id: string;
  accountId: string;
  cashDate: string; // YYYY-MM-DD (convertido para timestamptz meio-dia local)
}): Promise<ActionResult> {
  await requireOwner();
  if (!input.accountId) return { ok: false, error: 'Selecione a conta.' };

  await db
    .update(schema.financialEntries)
    .set({
      status: 'liquidado',
      accountId: input.accountId,
      cashDate: new Date(`${input.cashDate}T12:00:00-03:00`),
      updatedAt: new Date(),
    })
    .where(eq(schema.financialEntries.id, input.id));

  revalidatePath(FINANCEIRO_PATH);
  return { ok: true };
}

export async function cancelFinancialEntryAction(id: string): Promise<ActionResult> {
  await requireOwner();
  await db
    .update(schema.financialEntries)
    .set({ status: 'cancelado', updatedAt: new Date() })
    .where(eq(schema.financialEntries.id, id));

  revalidatePath(FINANCEIRO_PATH);
  return { ok: true };
}

// Trocar a conta de um lançamento já liquidado — funciona independente da
// origem (inclusive lançamentos automáticos da ponte de receita, Fatia 8),
// diferente de updateFinancialEntryAction (que é só pra manual). A conta é
// um dado operacional/de bookkeeping, não parte da "verdade" da origem.
export async function setFinancialEntryAccountAction(
  id: string,
  accountId: string,
): Promise<ActionResult> {
  await requireOwner();
  if (!accountId) return { ok: false, error: 'Selecione a conta.' };

  await db
    .update(schema.financialEntries)
    .set({ accountId, updatedAt: new Date() })
    .where(eq(schema.financialEntries.id, id));

  revalidatePath(FINANCEIRO_PATH);
  return { ok: true };
}

export async function reopenFinancialEntryAction(id: string): Promise<ActionResult> {
  await requireOwner();
  await db
    .update(schema.financialEntries)
    .set({ status: 'em_aberto', cashDate: null, updatedAt: new Date() })
    .where(eq(schema.financialEntries.id, id));

  revalidatePath(FINANCEIRO_PATH);
  return { ok: true };
}
