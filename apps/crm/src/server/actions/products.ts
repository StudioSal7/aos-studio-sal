'use server';

// Server actions for the products catalog (admin). Owner-only. Mirrors the
// forms action structure: requireAuth + requireRole, ActionResult, revalidatePath.

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { ProductTipo } from '@repo/db/schema';
import { requireAuth, requireRole } from '@/server/auth';
import { slugify } from '@/components/forms/slug';
import type { ActionResult } from './leads';

const ADMIN_PATH = '/admin/produtos';

async function requireOwner() {
  const auth = await requireAuth();
  requireRole(auth, 'owner');
  return auth;
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base || 'produto';
  let n = 1;
  while (true) {
    const [hit] = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

type ProductInput = {
  displayName: string;
  tipo: ProductTipo;
  valorCents: number | null;
};

export async function createProductAction(
  input: ProductInput,
): Promise<ActionResult<{ id: string }>> {
  await requireOwner();

  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: 'Nome obrigatório.' };

  const slug = await uniqueSlug(slugify(displayName) || 'produto');

  const [product] = await db
    .insert(schema.products)
    .values({
      slug,
      displayName,
      tipo: input.tipo,
      valorCents: input.valorCents,
      active: true,
    })
    .returning({ id: schema.products.id });

  if (!product) return { ok: false, error: 'Falha ao criar produto.' };

  revalidatePath(ADMIN_PATH);
  return { ok: true, data: { id: product.id } };
}

export async function updateProductAction(
  id: string,
  input: ProductInput,
): Promise<ActionResult> {
  await requireOwner();

  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: 'Nome obrigatório.' };

  await db
    .update(schema.products)
    .set({
      displayName,
      tipo: input.tipo,
      valorCents: input.valorCents,
      updatedAt: new Date(),
    })
    .where(eq(schema.products.id, id));

  revalidatePath(ADMIN_PATH);
  return { ok: true };
}

export async function setProductActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireOwner();

  await db
    .update(schema.products)
    .set({ active, updatedAt: new Date() })
    .where(eq(schema.products.id, id));

  revalidatePath(ADMIN_PATH);
  return { ok: true };
}
