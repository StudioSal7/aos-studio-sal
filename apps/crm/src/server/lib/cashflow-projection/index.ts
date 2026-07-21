/**
 * Projeta o saldo de caixa mês a mês: saldo atual + contas em aberto por
 * vencimento + recorrências ativas no mês. Puro — `today` é injetado (nunca
 * `new Date()` interno) pra ser 100% determinístico em teste.
 *
 * Granularidade mensal: uma recorrência conta uma vez no mês em que está
 * ativa, independente do dia exato do vencimento dentro do mês.
 */

export interface OpenEntryInput {
  kind: 'receita' | 'despesa';
  amountCents: number;
  dueDate: string; // YYYY-MM-DD
}

export interface RecurringTemplateInput {
  kind: 'receita' | 'despesa';
  amountCents: number;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
}

export interface CashflowProjectionInput {
  startingBalanceCents: number;
  openEntries: OpenEntryInput[];
  recurringTemplates: RecurringTemplateInput[];
  horizonMonths: number;
  today: Date;
}

export interface CashflowProjectionMonth {
  month: string; // 'YYYY-MM'
  saldoInicialCents: number;
  entradasCents: number;
  saidasCents: number;
  saldoFinalCents: number;
}

export interface CashflowProjectionResult {
  months: CashflowProjectionMonth[];
  saldoFinalCents: number;
  temMesNegativo: boolean;
}

function yearMonth(dateStr: string): { year: number; month: number } {
  const [y, m] = dateStr.split('-').map(Number);
  return { year: y!, month: m! }; // month 1-based
}

function recurringActiveInMonth(t: RecurringTemplateInput, year: number, month: number): boolean {
  const start = yearMonth(t.startDate);
  const startsBeforeOrDuring = year > start.year || (year === start.year && month >= start.month);
  if (!startsBeforeOrDuring) return false;

  if (!t.endDate) return true;
  const end = yearMonth(t.endDate);
  return year < end.year || (year === end.year && month <= end.month);
}

export function projectCashflow(input: CashflowProjectionInput): CashflowProjectionResult {
  const months: CashflowProjectionMonth[] = [];
  let saldo = input.startingBalanceCents;

  const startYear = input.today.getUTCFullYear();
  const startMonthIndex = input.today.getUTCMonth(); // 0-based

  for (let i = 0; i < input.horizonMonths; i++) {
    const d = new Date(Date.UTC(startYear, startMonthIndex + i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1; // 1-based
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    let entradasCents = 0;
    let saidasCents = 0;

    for (const entry of input.openEntries) {
      const due = yearMonth(entry.dueDate);
      if (due.year === year && due.month === month) {
        if (entry.kind === 'receita') entradasCents += entry.amountCents;
        else saidasCents += entry.amountCents;
      }
    }

    for (const template of input.recurringTemplates) {
      if (!recurringActiveInMonth(template, year, month)) continue;
      if (template.kind === 'receita') entradasCents += template.amountCents;
      else saidasCents += template.amountCents;
    }

    const saldoInicialCents = saldo;
    const saldoFinalCents = saldoInicialCents + entradasCents - saidasCents;
    months.push({ month: monthKey, saldoInicialCents, entradasCents, saidasCents, saldoFinalCents });
    saldo = saldoFinalCents;
  }

  return {
    months,
    saldoFinalCents: saldo,
    temMesNegativo: months.some((m) => m.saldoFinalCents < 0),
  };
}
