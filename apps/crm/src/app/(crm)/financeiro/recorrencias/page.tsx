import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth';
import { getFinancialAccounts, getFinancialCategories } from '@/server/queries/financial';
import { getFinancialRecurringTemplates } from '@/server/queries/financial-recurring';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { CreateRecurringForm } from './_components/create-recurring-form';
import { ToggleRecurringActiveButton } from './_components/toggle-recurring-active-button';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function RecorrenciasPage() {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const [categories, accounts, templates] = await Promise.all([
    getFinancialCategories(),
    getFinancialAccounts(),
    getFinancialRecurringTemplates(),
  ]);

  const categoryOptions = categories
    .filter((c) => c.parentId !== null)
    .map((c) => ({ id: c.id, name: c.name, entryKind: c.entryKind }));
  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name }));

  return (
    <div className="flex flex-col">
      <PageHeader title="financeiro · recorrências." />

      <div className="space-y-6 p-8">
        <div className="flex justify-end">
          <CreateRecurringForm categories={categoryOptions} accounts={accountOptions} />
        </div>

        <Card className="min-w-0 overflow-hidden p-0">
          {templates.length === 0 ? (
            <p className="px-5 py-6 text-body text-ink-muted">
              Nenhuma recorrência ainda — aluguel, ferramentas, pró-labore etc.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body text-ink">{t.description}</p>
                    <p className="truncate text-micro text-ink-muted normal-case tracking-normal">
                      {t.categoryName ?? '—'} · todo dia {t.dayOfMonth}
                      {t.accountName && ` · ${t.accountName}`}
                    </p>
                  </div>
                  <p className={`shrink-0 tabular-nums text-body ${t.kind === 'receita' ? 'text-leaf' : 'text-ink'}`}>
                    {t.kind === 'receita' ? '+' : '−'} {BRL.format(t.amountCents / 100)}
                  </p>
                  <div className="shrink-0 pl-4">
                    <ToggleRecurringActiveButton id={t.id} active={t.active} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
