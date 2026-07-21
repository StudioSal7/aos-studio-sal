import { asc, eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

export async function getFinancialCategories() {
  return db
    .select()
    .from(schema.financialCategories)
    .where(eq(schema.financialCategories.active, true))
    .orderBy(asc(schema.financialCategories.sortOrder));
}

export async function getFinancialAccounts() {
  return db
    .select()
    .from(schema.financialAccounts)
    .where(eq(schema.financialAccounts.active, true))
    .orderBy(asc(schema.financialAccounts.name));
}
