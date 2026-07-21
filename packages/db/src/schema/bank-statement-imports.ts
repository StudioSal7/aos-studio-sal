import { date, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { bankStatementFormatEnum } from './enums';
import { financialAccounts } from './financial-accounts';
import { users } from './users';

// Cabeçalho de cada importação de extrato bancário. As linhas ficam em
// bank_statement_lines (conciliação + idempotência).
export const bankStatementImports = pgTable(
  'bank_statement_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => financialAccounts.id),
    fileName: text('file_name').notNull(),
    format: bankStatementFormatEnum('format').notNull(),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    lineCount: integer('line_count').notNull().default(0),
    importedBy: uuid('imported_by').references(() => users.id),
    rawMeta: jsonb('raw_meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('bank_statement_imports_account_idx').on(table.accountId),
    createdAtIdx: index('bank_statement_imports_created_at_idx').on(table.createdAt),
  }),
);

export type BankStatementImport = typeof bankStatementImports.$inferSelect;
export type NewBankStatementImport = typeof bankStatementImports.$inferInsert;
