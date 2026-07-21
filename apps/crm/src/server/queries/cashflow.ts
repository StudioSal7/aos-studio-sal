import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { DateRange } from '@/server/lib/date-range/index';

export interface CashflowAccountRow {
  accountId: string;
  accountName: string;
  entradasCents: number;
  saidasCents: number;
  saldoPeriodoCents: number;
  saldoAtualCents: number; // saldo de abertura + todo o histórico liquidado (independe do período filtrado)
}

export interface CashflowRealized {
  accounts: CashflowAccountRow[];
  totalEntradasCents: number;
  totalSaidasCents: number;
  totalSaldoPeriodoCents: number;
  totalSaldoAtualCents: number;
}

// Fluxo de Caixa Realizado — lê por CASH DATE (quando o dinheiro de fato
// entrou/saiu), só lançamentos liquidados. `saldoAtual` usa o histórico
// inteiro (não filtrado), pois é "quanto tem na conta agora"; as demais
// colunas refletem só o período escolhido.
export async function getCashflowRealized(range: DateRange): Promise<CashflowRealized> {
  const accounts = await db
    .select({ id: schema.financialAccounts.id, name: schema.financialAccounts.name, openingBalanceCents: schema.financialAccounts.openingBalanceCents })
    .from(schema.financialAccounts)
    .where(eq(schema.financialAccounts.active, true));

  const liquidados = await db
    .select({
      accountId: schema.financialEntries.accountId,
      kind: schema.financialEntries.kind,
      amountCents: schema.financialEntries.amountCents,
      cashDate: schema.financialEntries.cashDate,
    })
    .from(schema.financialEntries)
    .where(
      and(eq(schema.financialEntries.status, 'liquidado'), isNotNull(schema.financialEntries.cashDate)),
    );

  const fromTime = range.from?.getTime() ?? null;
  const toTime = range.to?.getTime() ?? null;

  const rows: CashflowAccountRow[] = accounts.map((account) => {
    let entradasCents = 0;
    let saidasCents = 0;
    let allTimeNetCents = 0;

    for (const l of liquidados) {
      if (l.accountId !== account.id || !l.cashDate) continue;
      const signed = l.kind === 'receita' ? l.amountCents : -l.amountCents;
      allTimeNetCents += signed;

      const t = new Date(l.cashDate).getTime();
      const inRange = (fromTime === null || t >= fromTime) && (toTime === null || t < toTime);
      if (!inRange) continue;

      if (l.kind === 'receita') entradasCents += l.amountCents;
      else saidasCents += l.amountCents;
    }

    return {
      accountId: account.id,
      accountName: account.name,
      entradasCents,
      saidasCents,
      saldoPeriodoCents: entradasCents - saidasCents,
      saldoAtualCents: account.openingBalanceCents + allTimeNetCents,
    };
  });

  return {
    accounts: rows,
    totalEntradasCents: rows.reduce((sum, r) => sum + r.entradasCents, 0),
    totalSaidasCents: rows.reduce((sum, r) => sum + r.saidasCents, 0),
    totalSaldoPeriodoCents: rows.reduce((sum, r) => sum + r.saldoPeriodoCents, 0),
    totalSaldoAtualCents: rows.reduce((sum, r) => sum + r.saldoAtualCents, 0),
  };
}
