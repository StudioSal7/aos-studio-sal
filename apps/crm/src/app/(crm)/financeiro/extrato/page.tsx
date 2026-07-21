import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth';
import { getFinancialAccounts, getFinancialCategories } from '@/server/queries/financial';
import {
  getBankStatementLines,
  getCategorizationRules,
  getOpenEntriesForReconciliation,
} from '@/server/queries/bank-statement';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { UploadStatementForm } from './_components/upload-statement-form';
import { StatementLineRow } from './_components/statement-line-row';
import { CreateRuleForm } from './_components/create-rule-form';
import { ToggleRuleActiveButton } from './_components/toggle-rule-active-button';

export default async function ExtratoPage() {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const [accounts, categories, lines, openEntries, rules] = await Promise.all([
    getFinancialAccounts(),
    getFinancialCategories(),
    getBankStatementLines(),
    getOpenEntriesForReconciliation(),
    getCategorizationRules(),
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

        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-h3 text-ink">categorização automática (opcional).</h2>
            <CreateRuleForm categories={categoryOptions} />
          </div>
          <Card className="p-0">
            {rules.length === 0 ? (
              <p className="px-5 py-4 text-micro text-ink-muted">
                Nenhuma regra ainda — crie regras para sugerir a categoria de novas linhas do
                extrato automaticamente (ex.: descrição contém &quot;netflix&quot; → categoria
                streaming).
              </p>
            ) : (
              <div className="divide-y divide-line">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-body text-ink">&quot;{rule.pattern}&quot;</p>
                      <p className="text-micro text-ink-muted normal-case tracking-normal">
                        {rule.categoryName ?? '—'} · prioridade {rule.priority}
                      </p>
                    </div>
                    <ToggleRuleActiveButton id={rule.id} active={rule.active} />
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
