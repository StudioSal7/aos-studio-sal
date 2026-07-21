import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth';
import { getFinancialAccounts, getFinancialCategories } from '@/server/queries/financial';
import { getBankStatementLines, getOpenEntriesForReconciliation } from '@/server/queries/bank-statement';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { UploadStatementForm } from './_components/upload-statement-form';
import { StatementLineRow } from './_components/statement-line-row';

export default async function ExtratoPage() {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const [accounts, categories, lines, openEntries] = await Promise.all([
    getFinancialAccounts(),
    getFinancialCategories(),
    getBankStatementLines(),
    getOpenEntriesForReconciliation(),
  ]);

  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name }));
  const categoryOptions = categories
    .filter((c) => c.parentId !== null)
    .map((c) => ({ id: c.id, name: c.name, entryKind: c.entryKind }));

  const pendingCount = lines.filter((l) => l.status === 'nao_conciliado').length;

  return (
    <div className="flex flex-col">
      <PageHeader title="financeiro · extrato bancário." />

      <div className="space-y-6 p-8">
        <UploadStatementForm accounts={accountOptions} />

        {pendingCount > 0 && (
          <div className="border border-line bg-canvas px-5 py-3 text-body text-ink-muted">
            {pendingCount} {pendingCount === 1 ? 'linha' : 'linhas'} aguardando conciliação.
          </div>
        )}

        <Card className="min-w-0 overflow-hidden p-0">
          {lines.length === 0 ? (
            <p className="px-5 py-6 text-body text-ink-muted">
              Nenhum extrato importado ainda. Suba um arquivo OFX (ou CSV) acima.
            </p>
          ) : (
            <div>
              {lines.map((line) => (
                <StatementLineRow
                  key={line.id}
                  line={line}
                  openEntries={openEntries}
                  categories={categoryOptions}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
