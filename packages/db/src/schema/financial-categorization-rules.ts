import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { financialCategories } from './financial-categories';

// Regra simples de categorização automática (Fatia 10, opcional): se a
// descrição da linha do extrato contém `pattern` (case-insensitive), sugere
// `categoryId`. Aplicada só como SUGESTÃO na importação — o owner sempre pode
// sobrescrever antes de criar o lançamento.
export const financialCategorizationRules = pgTable(
  'financial_categorization_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pattern: text('pattern').notNull(), // substring, comparada em lowercase
    categoryId: uuid('category_id')
      .notNull()
      .references(() => financialCategories.id, { onDelete: 'cascade' }),
    priority: integer('priority').notNull().default(0), // maior = checada primeiro
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeIdx: index('financial_categorization_rules_active_idx').on(table.active),
  }),
);

export type FinancialCategorizationRule = typeof financialCategorizationRules.$inferSelect;
export type NewFinancialCategorizationRule = typeof financialCategorizationRules.$inferInsert;
