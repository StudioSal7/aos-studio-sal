'use server';

// Importação de extrato + conciliação. Owner-only. Idempotência garantida
// pelo índice único em bank_statement_lines.dedupHash (onConflictDoNothing) —
// reimportar o mesmo arquivo (ou um período sobreposto) nunca duplica linha.

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { requireAuth, requireRole } from '@/server/auth';
import { parseCsvStatement, parseOfxStatement } from '@/server/lib/ofx-parser/index';
import type { ActionResult } from './leads';

const EXTRATO_PATH = '/financeiro/extrato';

async function requireOwner() {
  const auth = await requireAuth();
  requireRole(auth, 'owner');
  return auth;
}

export interface ImportStatementResult {
  parsed: number;
  imported: number;
  duplicates: number;
  parseErrors: number;
}

export async function importBankStatementAction(
  formData: FormData,
): Promise<ActionResult<ImportStatementResult>> {
  const auth = await requireOwner();

  const accountId = String(formData.get('accountId') ?? '');
  const format = String(formData.get('format') ?? 'ofx') as 'ofx' | 'csv';
  const file = formData.get('file');

  if (!accountId) return { ok: false, error: 'Selecione a conta.' };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Selecione um arquivo.' };

  const content = await file.text();
  const result = format === 'csv' ? parseCsvStatement(content, accountId) : parseOfxStatement(content, accountId);

  if (result.transactions.length === 0) {
    return {
      ok: false,
      error: `Nenhuma transação reconhecida no arquivo (${result.errors.length} erro(s) de parse).`,
    };
  }

  const dates = result.transactions.map((t) => t.postedAt.getTime());
  const [importRow] = await db
    .insert(schema.bankStatementImports)
    .values({
      accountId,
      fileName: file.name,
      format,
      periodStart: new Date(Math.min(...dates)).toISOString().slice(0, 10),
      periodEnd: new Date(Math.max(...dates)).toISOString().slice(0, 10),
      lineCount: result.transactions.length,
      importedBy: auth.userId,
      rawMeta: { parseErrors: result.errors.length },
    })
    .returning({ id: schema.bankStatementImports.id });

  let imported = 0;
  for (const t of result.transactions) {
    const inserted = await db
      .insert(schema.bankStatementLines)
      .values({
        importId: importRow!.id,
        accountId,
        postedAt: t.postedAt,
        amountCents: t.amountCents,
        description: t.description,
        fitid: t.fitid,
        dedupHash: t.dedupHash,
        rawRow: { source: format },
      })
      .onConflictDoNothing({ target: schema.bankStatementLines.dedupHash })
      .returning({ id: schema.bankStatementLines.id });
    if (inserted.length > 0) imported += 1;
  }

  revalidatePath(EXTRATO_PATH);

  return {
    ok: true,
    data: {
      parsed: result.transactions.length,
      imported,
      duplicates: result.transactions.length - imported,
      parseErrors: result.errors.length,
    },
  };
}

// Concilia a linha do extrato com um lançamento JÁ existente (em aberto):
// liquida o lançamento usando a data e a conta da linha, e marca a linha
// como conciliada.
export async function reconcileLineWithEntryAction(
  lineId: string,
  entryId: string,
): Promise<ActionResult> {
  await requireOwner();

  const [line] = await db
    .select({ postedAt: schema.bankStatementLines.postedAt, accountId: schema.bankStatementLines.accountId })
    .from(schema.bankStatementLines)
    .where(eq(schema.bankStatementLines.id, lineId))
    .limit(1);
  if (!line) return { ok: false, error: 'Linha do extrato não encontrada.' };

  await db
    .update(schema.financialEntries)
    .set({
      status: 'liquidado',
      accountId: line.accountId,
      cashDate: line.postedAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.financialEntries.id, entryId));

  await db
    .update(schema.bankStatementLines)
    .set({ status: 'conciliado', reconciledEntryId: entryId })
    .where(eq(schema.bankStatementLines.id, lineId));

  revalidatePath(EXTRATO_PATH);
  revalidatePath('/financeiro');
  revalidatePath('/financeiro/fluxo');
  return { ok: true };
}

// Cria um lançamento NOVO a partir de uma linha sem lançamento correspondente
// (ex.: tarifa bancária, transferência não prevista) e já concilia com ela.
export async function createEntryFromLineAction(input: {
  lineId: string;
  description: string;
  categoryId: string;
}): Promise<ActionResult> {
  const auth = await requireOwner();

  const [line] = await db
    .select()
    .from(schema.bankStatementLines)
    .where(eq(schema.bankStatementLines.id, input.lineId))
    .limit(1);
  if (!line) return { ok: false, error: 'Linha do extrato não encontrada.' };

  const kind: 'receita' | 'despesa' = line.amountCents >= 0 ? 'receita' : 'despesa';
  const competenceDate = line.postedAt.toISOString().slice(0, 10);

  const [entry] = await db
    .insert(schema.financialEntries)
    .values({
      kind,
      description: input.description.trim() || line.description,
      amountCents: Math.abs(line.amountCents),
      competenceDate,
      cashDate: line.postedAt,
      status: 'liquidado',
      categoryId: input.categoryId,
      accountId: line.accountId,
      originSource: 'bank_reconciliation',
      createdBy: auth.userId,
    })
    .returning({ id: schema.financialEntries.id });

  await db
    .update(schema.bankStatementLines)
    .set({ status: 'conciliado', reconciledEntryId: entry!.id })
    .where(eq(schema.bankStatementLines.id, input.lineId));

  revalidatePath(EXTRATO_PATH);
  revalidatePath('/financeiro');
  revalidatePath('/financeiro/fluxo');
  return { ok: true };
}

export async function ignoreLineAction(lineId: string): Promise<ActionResult> {
  await requireOwner();
  await db
    .update(schema.bankStatementLines)
    .set({ status: 'ignorado' })
    .where(eq(schema.bankStatementLines.id, lineId));

  revalidatePath(EXTRATO_PATH);
  return { ok: true };
}
