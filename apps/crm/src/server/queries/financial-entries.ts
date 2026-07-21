import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { DateRange } from '@/server/lib/date-range/index';

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Lançamentos no período, filtrados por COMPETÊNCIA (alimenta o DRE).
export async function getFinancialEntriesByCompetence(range: DateRange) {
  const conditions = [];
  if (range.from) conditions.push(gte(schema.financialEntries.competenceDate, toDateOnly(range.from)));
  if (range.to) conditions.push(lt(schema.financialEntries.competenceDate, toDateOnly(range.to)));

  return db
    .select({
      id: schema.financialEntries.id,
      kind: schema.financialEntries.kind,
      description: schema.financialEntries.description,
      amountCents: schema.financialEntries.amountCents,
      competenceDate: schema.financialEntries.competenceDate,
      dueDate: schema.financialEntries.dueDate,
      cashDate: schema.financialEntries.cashDate,
      status: schema.financialEntries.status,
      originSource: schema.financialEntries.originSource,
      categoryId: schema.financialEntries.categoryId,
      categoryName: schema.financialCategories.name,
      dreSection: schema.financialCategories.dreSection,
      accountId: schema.financialEntries.accountId,
      accountName: schema.financialAccounts.name,
    })
    .from(schema.financialEntries)
    .leftJoin(schema.financialCategories, eq(schema.financialEntries.categoryId, schema.financialCategories.id))
    .leftJoin(schema.financialAccounts, eq(schema.financialEntries.accountId, schema.financialAccounts.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.financialEntries.competenceDate), desc(schema.financialEntries.createdAt));
}

export async function getFinancialEntryById(id: string) {
  const [row] = await db
    .select()
    .from(schema.financialEntries)
    .where(eq(schema.financialEntries.id, id))
    .limit(1);
  return row ?? null;
}
