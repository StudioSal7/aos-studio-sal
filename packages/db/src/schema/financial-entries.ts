import { sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  financialEntryKindEnum,
  financialEntryStatusEnum,
  financialOriginSourceEnum,
} from './enums';
import { financialAccounts } from './financial-accounts';
import { financialCategories } from './financial-categories';
import { financialRecurringTemplates } from './financial-recurring-templates';
import { leads } from './leads';
import { salSales } from './sal-sales';
import { users } from './users';

// Lançamento — o coração do módulo. Duas datas (decisão do André):
//  - competenceDate (quando a receita/despesa ACONTECE) → alimenta o DRE.
//  - cashDate (quando o dinheiro ENTRA/SAI) → alimenta o Fluxo realizado;
//    NULL = em aberto/previsto.
// Dinheiro em centavos inteiros; `amountCents` é sempre positivo, o sinal vem
// de `kind`. Anti-dupla-contagem: índices únicos parciais por origem.
export const financialEntries = pgTable(
  'financial_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: financialEntryKindEnum('kind').notNull(),
    description: text('description').notNull(),
    amountCents: integer('amount_cents').notNull(),

    competenceDate: date('competence_date').notNull(),
    dueDate: date('due_date'),
    cashDate: timestamp('cash_date', { withTimezone: true }),

    status: financialEntryStatusEnum('status').notNull().default('em_aberto'),

    categoryId: uuid('category_id')
      .notNull()
      .references(() => financialCategories.id),
    accountId: uuid('account_id').references(() => financialAccounts.id),

    originSource: financialOriginSourceEnum('origin_source').notNull().default('manual'),
    originHotmartSaleId: uuid('origin_hotmart_sale_id').references(() => salSales.id, {
      onDelete: 'set null',
    }),
    originLeadId: uuid('origin_lead_id').references(() => leads.id, { onDelete: 'set null' }),
    recurringTemplateId: uuid('recurring_template_id').references(
      () => financialRecurringTemplates.id,
      { onDelete: 'set null' },
    ),

    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    competenceIdx: index('financial_entries_competence_idx').on(table.competenceDate),
    cashIdx: index('financial_entries_cash_idx').on(table.cashDate),
    dueIdx: index('financial_entries_due_idx').on(table.dueDate),
    statusIdx: index('financial_entries_status_idx').on(table.status),
    categoryIdx: index('financial_entries_category_idx').on(table.categoryId),
    accountIdx: index('financial_entries_account_idx').on(table.accountId),
    // Idempotência: cada venda Hotmart / lead pago vira no MÁXIMO um lançamento.
    hotmartUnique: uniqueIndex('financial_entries_hotmart_unique')
      .on(table.originHotmartSaleId)
      .where(sql`origin_hotmart_sale_id is not null`),
    leadUnique: uniqueIndex('financial_entries_lead_unique')
      .on(table.originLeadId)
      .where(sql`origin_lead_id is not null`),
  }),
);

export type FinancialEntry = typeof financialEntries.$inferSelect;
export type NewFinancialEntry = typeof financialEntries.$inferInsert;
