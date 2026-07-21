import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth';
import { getFinancialAccounts, getFinancialCategories } from '@/server/queries/financial';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { CreateAccountForm } from './_components/create-account-form';
import { CreateCategoryForm } from './_components/create-category-form';
import { ToggleActiveButton } from './_components/toggle-active-button';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function centsToBRL(cents: number): string {
  return BRL.format(cents / 100);
}

const ACCOUNT_KIND_LABEL: Record<string, string> = {
  banco: 'banco',
  caixa: 'caixa',
  carteira_digital: 'carteira digital',
};

export default async function FinanceiroConfigPage() {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const [categories, accounts] = await Promise.all([
    getFinancialCategories(),
    getFinancialAccounts(),
  ]);

  const groups = categories.filter((c) => c.parentId === null);

  return (
    <div className="flex flex-col">
      <PageHeader title="financeiro · configuração." />

      <div className="space-y-10 p-8">
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-h3 text-ink">plano de contas.</h2>
            <CreateCategoryForm
              groups={groups.map((g) => ({ id: g.id, name: g.name, dreSection: g.dreSection }))}
            />
          </div>
          <div className="flex flex-col gap-6">
            {groups.map((group) => {
              const children = categories.filter((c) => c.parentId === group.id);
              return (
                <Card key={group.id} className="p-0">
                  <div className="border-b border-line px-5 py-3">
                    <p className="text-body font-medium text-ink">{group.name}</p>
                    <p className="text-micro text-ink-muted normal-case tracking-normal">
                      {group.entryKind} · {group.dreSection.replace('_', ' ')}
                    </p>
                  </div>
                  {children.length === 0 ? (
                    <p className="px-5 py-4 text-micro text-ink-muted">Nenhuma categoria aqui ainda.</p>
                  ) : (
                    <div className="divide-y divide-line">
                      {children.map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between px-5 py-3">
                          <p className="text-body text-ink">{cat.name}</p>
                          <div className="flex items-center gap-4">
                            {!cat.isSystem && (
                              <span className="text-micro text-ink-muted">customizada</span>
                            )}
                            <ToggleActiveButton entity="category" id={cat.id} active={cat.active} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-h3 text-ink">contas e carteiras.</h2>
            <CreateAccountForm />
          </div>
          <Card className="p-0">
            {accounts.length === 0 ? (
              <p className="px-5 py-4 text-micro text-ink-muted">Nenhuma conta ainda.</p>
            ) : (
              <div className="divide-y divide-line">
                {accounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-body text-ink">{acc.name}</p>
                      <p className="text-micro text-ink-muted normal-case tracking-normal">
                        {ACCOUNT_KIND_LABEL[acc.kind] ?? acc.kind} · saldo de abertura{' '}
                        {centsToBRL(acc.openingBalanceCents)}
                      </p>
                    </div>
                    <ToggleActiveButton entity="account" id={acc.id} active={acc.active} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
