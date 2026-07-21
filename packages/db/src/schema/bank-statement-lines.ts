import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { bankStatementLineStatusEnum } from './enums';
import { bankStatementImports } from './bank-statement-imports';
import { financialAccounts } from './financial-accounts';
import { financialEntries } from './financial-entries';

// Linhas do extrato importado. `amountCents` COM sinal (+entrada / −saída).
// `dedupHash` único impede reimportar a mesma transação. `reconciledEntryId`
// liga a linha ao lançamento conciliado.
export const bankStatementLines = pgTable(
  'bank_statement_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    importId: uuid('import_id')
      .notNull()
      .references(() => bankStatementImports.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => financialAccounts.id),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    description: text('description').notNull(),
    fitid: text('fitid'),
    dedupHash: text('dedup_hash').notNull(),
    reconciledEntryId: uuid('reconciled_entry_id').references(() => financialEntries.id, {
      onDelete: 'set null',
    }),
    status: bankStatementLineStatusEnum('status').notNull().default('nao_conciliado'),
    rawRow: jsonb('raw_row'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dedupUnique: uniqueIndex('bank_statement_lines_dedup_unique').on(table.dedupHash),
    importIdx: index('bank_statement_lines_import_idx').on(table.importId),
    accountIdx: index('bank_statement_lines_account_idx').on(table.accountId),
    statusIdx: index('bank_statement_lines_status_idx').on(table.status),
  }),
);

export type BankStatementLine = typeof bankStatementLines.$inferSelect;
export type NewBankStatementLine = typeof bankStatementLines.$inferInsert;
