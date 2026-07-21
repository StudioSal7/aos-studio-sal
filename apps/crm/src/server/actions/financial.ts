'use server';

// Server actions do módulo financeiro. Owner-only. Mirrors forms.ts:
// requireAuth + requireRole, ActionResult, revalidatePath.

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { requireAuth, requireRole } from '@/server/auth';
import { slugify } from '@/components/forms/slug';
import type { ActionResult } from './leads';

const CONFIG_PATH = '/financeiro/config';

async function requireOwner() {
  const auth = await requireAuth();
  requireRole(auth, 'owner');
  return auth;
}

export async function createFinancialAccountAction(input: {
  name: string;
  kind: 'banco' | 'caixa' | 'carteira_digital';
  openingBalanceCents: number;
}): Promise<ActionResult> {
  await requireOwner();
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Nome obrigatório.' };

  await db.insert(schema.financialAccounts).values({
    name,
    kind: input.kind,
    openingBalanceCents: input.openingBalanceCents,
  });

  revalidatePath(CONFIG_PATH);
  return { ok: true };
}

export async function toggleFinancialAccountActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireOwner();
  await db
    .update(schema.financialAccounts)
    .set({ active, updatedAt: new Date() })
    .where(eq(schema.financialAccounts.id, id));

  revalidatePath(CONFIG_PATH);
  return { ok: true };
}

export async function createFinancialCategoryAction(input: {
  name: string;
  entryKind: 'receita' | 'despesa';
  dreSection:
    | 'receita_bruta'
    | 'deducao'
    | 'imposto'
    | 'custo'
    | 'despesa_fixa'
    | 'despesa_variavel'
    | 'outra';
  parentId: string | null;
}): Promise<ActionResult> {
  await requireOwner();
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Nome obrigatório.' };

  const slug = `custom-${slugify(name)}-${Date.now().toString(36)}`;

  await db.insert(schema.financialCategories).values({
    slug,
    name,
    entryKind: input.entryKind,
    dreSection: input.dreSection,
    parentId: input.parentId,
    isSystem: false,
  });

  revalidatePath(CONFIG_PATH);
  return { ok: true };
}

export async function toggleFinancialCategoryActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireOwner();
  await db
    .update(schema.financialCategories)
    .set({ active, updatedAt: new Date() })
    .where(eq(schema.financialCategories.id, id));

  revalidatePath(CONFIG_PATH);
  return { ok: true };
}
