import { asc, eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

export type ProductRow = {
  id: string;
  slug: string;
  displayName: string;
  tipo: 'mentoria' | 'infoproduto' | null;
  valorCents: number | null;
  active: boolean;
};

export async function listProducts(): Promise<ProductRow[]> {
  return db
    .select({
      id: schema.products.id,
      slug: schema.products.slug,
      displayName: schema.products.displayName,
      tipo: schema.products.tipo,
      valorCents: schema.products.valorCents,
      active: schema.products.active,
    })
    .from(schema.products)
    .orderBy(asc(schema.products.displayName));
}

export async function listActiveProducts(): Promise<ProductRow[]> {
  const all = await listProducts();
  return all.filter((p) => p.active);
}

export async function getProductById(id: string): Promise<ProductRow | null> {
  const [product] = await db
    .select({
      id: schema.products.id,
      slug: schema.products.slug,
      displayName: schema.products.displayName,
      tipo: schema.products.tipo,
      valorCents: schema.products.valorCents,
      active: schema.products.active,
    })
    .from(schema.products)
    .where(eq(schema.products.id, id))
    .limit(1);
  return product ?? null;
}
