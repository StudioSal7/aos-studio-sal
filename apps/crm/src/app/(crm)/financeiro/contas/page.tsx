import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth';
import { getFinancialAccounts, getFinancialCategories } from '@/server/queries/financial';
import { getOpenFinancialEntries } from '@/server/queries/financial-entries';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { EntryRow } from '../_components/entry-row';

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

export default async function ContasEmAbertoPage() {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const [categories, accounts, entries] = await Promise.all([
    getFinancialCategories(),
    getFinancialAccounts(),
    getOpenFinancialEntries(),
  ]);

  const categoryOptions = categories
    .filter((c) => c.parentId !== null)
    .map((c) => ({ id: c.id, name: c.name, entryKind: c.entryKind }));
  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name }));

  const overdueCount = entries.filter((e) => isOverdue(e.dueDate)).length;

  return (
    <div className="flex flex-col">
      <PageHeader title="financeiro · contas a pagar e a receber." />

      <div className="space-y-6 p-8">
        {overdueCount > 0 && (
          <div className="border border-clay bg-clay/5 px-5 py-3 text-body text-clay">
            {overdueCount} {overdueCount === 1 ? 'conta vencida' : 'contas vencidas'} aguardando liquidação.
          </div>
        )}

        <Card className="min-w-0 overflow-hidden p-0">
          {entries.length === 0 ? (
            <p className="px-5 py-6 text-body text-ink-muted">Nenhuma conta em aberto.</p>
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
      </div>
    </div>
  );
}
