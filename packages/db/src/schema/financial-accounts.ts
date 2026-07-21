import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { financialAccountKindEnum } from './enums';

// Contas/carteiras do módulo financeiro (banco, caixa, carteira digital).
// Suporta mais de uma. Saldo de abertura em centavos inteiros.
export const financialAccounts = pgTable(
  'financial_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    kind: financialAccountKindEnum('kind').notNull().default('banco'),
    openingBalanceCents: integer('opening_balance_cents').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeIdx: index('financial_accounts_active_idx').on(table.active),
  }),
);

export type FinancialAccount = typeof financialAccounts.$inferSelect;
export type NewFinancialAccount = typeof financialAccounts.$inferInsert;
