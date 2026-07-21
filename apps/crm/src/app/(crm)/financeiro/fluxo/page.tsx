import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth';
import { getCashflowProjectionInputs, getCashflowRealized } from '@/server/queries/cashflow';
import { projectCashflow } from '@/server/lib/cashflow-projection/index';
import {
  DEFAULT_DATE_RANGE,
  isDateRangeOption,
  resolveDateRange,
  DATE_RANGE_OPTIONS,
} from '@/server/lib/date-range/index';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { PeriodFilter } from '@/components/ui/period-filter';

const PROJECTION_HORIZON_MONTHS = 6;

const MONTH_LABELS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return `${MONTH_LABELS[Number(month) - 1]}/${year!.slice(-2)}`;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function fmt(cents: number): string {
  return BRL.format(cents / 100);
}

export default async function FluxoDeCaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const params = await searchParams;
  const rangeOption = isDateRangeOption(params.range) ? params.range : DEFAULT_DATE_RANGE;
  const range = resolveDateRange(rangeOption);

  const [cashflow, projectionInputs] = await Promise.all([
    getCashflowRealized(range),
    getCashflowProjectionInputs(),
  ]);

  const projection = projectCashflow({
    ...projectionInputs,
    horizonMonths: PROJECTION_HORIZON_MONTHS,
    today: new Date(),
  });

  return (
    <div className="flex flex-col">
      <PageHeader title="financeiro · fluxo de caixa.">
        <PeriodFilter current={rangeOption} options={DATE_RANGE_OPTIONS} />
      </PageHeader>

      <div className="space-y-8 p-8">
        <p className="text-micro uppercase tracking-widest text-ink-muted">realizado.</p>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-micro text-ink-muted">entradas no período</p>
            <p className="mt-3 text-h2 text-leaf">{fmt(cashflow.totalEntradasCents)}</p>
          </Card>
          <Card>
            <p className="text-micro text-ink-muted">saídas no período</p>
            <p className="mt-3 text-h2 text-ink">{fmt(cashflow.totalSaidasCents)}</p>
          </Card>
          <Card className={cashflow.totalSaldoPeriodoCents < 0 ? 'border-clay' : 'border-leaf'}>
            <p className="text-micro text-ink-muted">saldo do período</p>
            <p className={`mt-3 text-h2 ${cashflow.totalSaldoPeriodoCents < 0 ? 'text-clay' : 'text-leaf'}`}>
              {fmt(cashflow.totalSaldoPeriodoCents)}
            </p>
          </Card>
        </div>

        <section>
          <h2 className="mb-5 text-h3 text-ink">por conta.</h2>
          <Card className="min-w-0 overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-canvas">
                  <th className="px-5 py-3 text-left text-micro text-ink-muted">conta</th>
                  <th className="px-4 py-3 text-right text-micro text-ink-muted">entradas</th>
                  <th className="px-4 py-3 text-right text-micro text-ink-muted">saídas</th>
                  <th className="px-4 py-3 text-right text-micro text-ink-muted">saldo período</th>
                  <th className="px-4 py-3 text-right text-micro text-ink-muted">saldo atual</th>
                </tr>
              </thead>
              <tbody>
                {cashflow.accounts.map((acc) => (
                  <tr key={acc.accountId} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-body text-ink">{acc.accountName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-body text-leaf">
                      {fmt(acc.entradasCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-body text-ink">
                      {fmt(acc.saidasCents)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums text-body ${acc.saldoPeriodoCents < 0 ? 'text-clay' : 'text-ink'}`}
                    >
                      {fmt(acc.saldoPeriodoCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-body font-medium text-ink">
                      {fmt(acc.saldoAtualCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between">
            <p className="text-micro uppercase tracking-widest text-ink-muted">projetado.</p>
            {projection.temMesNegativo && (
              <span className="border border-clay bg-clay/5 px-3 py-1 text-micro text-clay">
                atenção: saldo negativo projetado em algum mês
              </span>
            )}
          </div>
          <p className="mb-5 text-micro text-ink-muted normal-case tracking-normal">
            Saldo atual + contas em aberto por vencimento + recorrências ativas, projetados por{' '}
            {PROJECTION_HORIZON_MONTHS} meses.
          </p>
          <Card className="min-w-0 overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-canvas">
                  <th className="px-5 py-3 text-left text-micro text-ink-muted">mês</th>
                  <th className="px-4 py-3 text-right text-micro text-ink-muted">entradas previstas</th>
                  <th className="px-4 py-3 text-right text-micro text-ink-muted">saídas previstas</th>
                  <th className="px-4 py-3 text-right text-micro text-ink-muted">saldo projetado</th>
                </tr>
              </thead>
              <tbody>
                {projection.months.map((m) => (
                  <tr key={m.month} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-body text-ink">{formatMonthLabel(m.month)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-body text-leaf">
                      {fmt(m.entradasCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-body text-ink">
                      {fmt(m.saidasCents)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums text-body font-medium ${m.saldoFinalCents < 0 ? 'text-clay' : 'text-ink'}`}
                    >
                      {fmt(m.saldoFinalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      </div>
    </div>
  );
}
