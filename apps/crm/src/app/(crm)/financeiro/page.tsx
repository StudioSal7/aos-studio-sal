import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth';
import { getFinancialAccounts, getFinancialCategories } from '@/server/queries/financial';
import { getFinancialEntriesByCompetence } from '@/server/queries/financial-entries';
import { DEFAULT_DATE_RANGE, isDateRangeOption, resolveDateRange } from '@/server/lib/date-range/index';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { PeriodFilter } from '@/components/ui/period-filter';
import { DATE_RANGE_OPTIONS } from '@/server/lib/date-range/index';
import { CreateEntryButton } from './_components/create-entry-button';
import { EntryRow } from './_components/entry-row';
import { SyncRevenueBridgeButton } from './_components/sync-revenue-bridge-button';

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const params = await searchParams;
  const rangeOption = isDateRangeOption(params.range) ? params.range : DEFAULT_DATE_RANGE;
  const range = resolveDateRange(rangeOption);

  const [categories, accounts, entries] = await Promise.all([
    getFinancialCategories(),
    getFinancialAccounts(),
    getFinancialEntriesByCompetence(range),
  ]);

  const categoryOptions = categories
    .filter((c) => c.parentId !== null)
    .map((c) => ({ id: c.id, name: c.name, entryKind: c.entryKind }));
  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name }));

  const totalReceita = entries
    .filter((e) => e.kind === 'receita' && e.status !== 'cancelado')
    .reduce((sum, e) => sum + e.amountCents, 0);
  const totalDespesa = entries
    .filter((e) => e.kind === 'despesa' && e.status !== 'cancelado')
    .reduce((sum, e) => sum + e.amountCents, 0);

  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="flex flex-col">
      <PageHeader title="financeiro.">
        <div className="flex items-center gap-4">
          <SyncRevenueBridgeButton />
          <PeriodFilter current={rangeOption} options={DATE_RANGE_OPTIONS} />
        </div>
      </PageHeader>

      <div className="space-y-8 p-8">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <p className="text-micro text-ink-muted">receitas no período (competência)</p>
            <p className="mt-3 text-h2 text-leaf">{BRL.format(totalReceita / 100)}</p>
          </Card>
          <Card>
            <p className="text-micro text-ink-muted">despesas no período (competência)</p>
            <p className="mt-3 text-h2 text-ink">{BRL.format(totalDespesa / 100)}</p>
          </Card>
        </div>

        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-h3 text-ink">lançamentos.</h2>
            <CreateEntryButton categories={categoryOptions} />
          </div>
          <Card className="min-w-0 overflow-hidden p-0">
            {entries.length === 0 ? (
              <p className="px-5 py-6 text-body text-ink-muted">Nenhum lançamento neste período.</p>
            ) : (
              <div>
                {entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={{
                      id: entry.id,
                      kind: entry.kind,
                      description: entry.description,
                      amountCents: entry.amountCents,
                      competenceDate: entry.competenceDate,
                      dueDate: entry.dueDate,
                      cashDate: entry.cashDate,
                      status: entry.status,
                      originSource: entry.originSource,
                      categoryId: entry.categoryId,
                      categoryName: entry.categoryName,
                      accountName: entry.accountName,
                    }}
                    categories={categoryOptions}
                    accounts={accountOptions}
                  />
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
