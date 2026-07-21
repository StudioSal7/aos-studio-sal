import { desc, eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

export async function getBankStatementLines() {
  return db
    .select({
      id: schema.bankStatementLines.id,
      accountId: schema.bankStatementLines.accountId,
      accountName: schema.financialAccounts.name,
      postedAt: schema.bankStatementLines.postedAt,
      amountCents: schema.bankStatementLines.amountCents,
      description: schema.bankStatementLines.description,
      status: schema.bankStatementLines.status,
      fitid: schema.bankStatementLines.fitid,
      importFileName: schema.bankStatementImports.fileName,
    })
    .from(schema.bankStatementLines)
    .leftJoin(schema.financialAccounts, eq(schema.bankStatementLines.accountId, schema.financialAccounts.id))
    .leftJoin(schema.bankStatementImports, eq(schema.bankStatementLines.importId, schema.bankStatementImports.id))
    .orderBy(desc(schema.bankStatementLines.postedAt));
}

// Lançamentos em aberto (candidatos a conciliar com uma linha do extrato).
export async function getOpenEntriesForReconciliation() {
  return db
    .select({
      id: schema.financialEntries.id,
      description: schema.financialEntries.description,
      amountCents: schema.financialEntries.amountCents,
      kind: schema.financialEntries.kind,
      competenceDate: schema.financialEntries.competenceDate,
    })
    .from(schema.financialEntries)
    .where(eq(schema.financialEntries.status, 'em_aberto'));
}
