import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth';
import { getDreLineInputs } from '@/server/queries/financial-entries';
import { buildDre } from '@/server/lib/dre-builder/index';
import { DEFAULT_DATE_RANGE, isDateRangeOption, resolveDateRange, DATE_RANGE_OPTIONS } from '@/server/lib/date-range/index';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { PeriodFilter } from '@/components/ui/period-filter';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function fmt(cents: number): string {
  return BRL.format(cents / 100);
}

function colorFor(cents: number): string {
  return cents < 0 ? 'text-clay' : 'text-ink';
}

export default async function DrePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const params = await searchParams;
  const rangeOption = isDateRangeOption(params.range) ? params.range : DEFAULT_DATE_RANGE;
  const range = resolveDateRange(rangeOption);

  const lines = await getDreLineInputs(range);
  const dre = buildDre(lines);

  return (
    <div className="flex flex-col">
      <PageHeader title="financeiro · dre gerencial.">
        <PeriodFilter current={rangeOption} options={DATE_RANGE_OPTIONS} />
      </PageHeader>

      <div className="space-y-8 p-8">
        <Card className="min-w-0 overflow-hidden p-0">
          <table className="w-full">
            <tbody>
              {dre.sections.map((section) => {
                if (section.section === 'receita_bruta') {
                  return (
                    <tr key={section.section} className="border-b border-line">
                      <td className="px-5 py-3 text-body font-medium text-ink">{section.label}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-body text-ink">
                        {fmt(section.totalCents)}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={section.section} className="border-b border-line">
                    <td className="px-5 py-3 pl-8 text-body text-ink-muted">(−) {section.label}</td>
                    <td className={`px-5 py-3 text-right tabular-nums text-body ${colorFor(section.totalCents)}`}>
                      {fmt(Math.abs(section.totalCents))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-micro text-ink-muted">receita líquida</p>
            <p className={`mt-3 text-h2 ${colorFor(dre.receitaLiquidaCents)}`}>
              {fmt(dre.receitaLiquidaCents)}
            </p>
          </Card>
          <Card>
            <p className="text-micro text-ink-muted">lucro bruto</p>
            <p className={`mt-3 text-h2 ${colorFor(dre.lucroBrutoCents)}`}>
              {fmt(dre.lucroBrutoCents)}
            </p>
          </Card>
          <Card className={dre.resultadoLiquidoCents < 0 ? 'border-clay' : 'border-leaf'}>
            <p className="text-micro text-ink-muted">resultado líquido</p>
            <p className={`mt-3 text-h2 ${dre.resultadoLiquidoCents < 0 ? 'text-clay' : 'text-leaf'}`}>
              {fmt(dre.resultadoLiquidoCents)}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
