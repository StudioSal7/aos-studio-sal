import { asc, eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

export async function getFinancialRecurringTemplates() {
  return db
    .select({
      id: schema.financialRecurringTemplates.id,
      kind: schema.financialRecurringTemplates.kind,
      description: schema.financialRecurringTemplates.description,
      amountCents: schema.financialRecurringTemplates.amountCents,
      dayOfMonth: schema.financialRecurringTemplates.dayOfMonth,
      startDate: schema.financialRecurringTemplates.startDate,
      endDate: schema.financialRecurringTemplates.endDate,
      active: schema.financialRecurringTemplates.active,
      categoryId: schema.financialRecurringTemplates.categoryId,
      categoryName: schema.financialCategories.name,
      accountId: schema.financialRecurringTemplates.accountId,
      accountName: schema.financialAccounts.name,
    })
    .from(schema.financialRecurringTemplates)
    .leftJoin(
      schema.financialCategories,
      eq(schema.financialRecurringTemplates.categoryId, schema.financialCategories.id),
    )
    .leftJoin(
      schema.financialAccounts,
      eq(schema.financialRecurringTemplates.accountId, schema.financialAccounts.id),
    )
    .orderBy(asc(schema.financialRecurringTemplates.dayOfMonth));
}
