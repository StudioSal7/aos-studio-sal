import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { financialEntryKindEnum } from './enums';
import { financialAccounts } from './financial-accounts';
import { financialCategories } from './financial-categories';

// Recorrências (aluguel, pró-labore, ferramentas). A projeção de caixa expande
// o template N meses à frente (módulo puro) — não materializa lançamentos por padrão.
export const financialRecurringTemplates = pgTable(
  'financial_recurring_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: financialEntryKindEnum('kind').notNull(),
    description: text('description').notNull(),
    amountCents: integer('amount_cents').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => financialCategories.id),
    accountId: uuid('account_id').references(() => financialAccounts.id),
    dayOfMonth: integer('day_of_month').notNull(), // dia do vencimento (1-31)
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    active: boolean('active').notNull().default(true),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeIdx: index('financial_recurring_active_idx').on(table.active),
    categoryIdx: index('financial_recurring_category_idx').on(table.categoryId),
  }),
);

export type FinancialRecurringTemplate = typeof financialRecurringTemplates.$inferSelect;
export type NewFinancialRecurringTemplate = typeof financialRecurringTemplates.$inferInsert;
