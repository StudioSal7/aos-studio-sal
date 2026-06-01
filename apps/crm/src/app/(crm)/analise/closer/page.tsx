import type { Route } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireAuth } from '@/server/auth';
import { listAnalyses, getAnalysisKpis } from '@/server/queries/commercial';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnalysisList } from './_components/analysis-list';

export default async function CloserAnalysisPage() {
  await requireAuth();

  const [analyses, kpis] = await Promise.all([
    listAnalyses('closer'),
    getAnalysisKpis('closer'),
  ]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="análise closer.">
        <Link href={"/analise/closer/nova" as Route<string>}>
          <Button variant="solid" size="sm">
            <Plus size={16} className="mr-1.5" />
            nova análise
          </Button>
        </Link>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-micro text-ink-muted">analisadas</p>
          <p className="mt-1 text-display">{kpis.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-micro text-ink-muted">score médio</p>
          <p className="mt-1 text-display">{kpis.avgScore ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-micro text-ink-muted">este mês</p>
          <p className="mt-1 text-display">{kpis.thisMonth}</p>
        </Card>
        <Card className="p-4">
          <p className="text-micro text-ink-muted">fechamentos</p>
          <p className="mt-1 text-display">{kpis.closedCount ?? '—'}</p>
        </Card>
      </div>

      {/* Lista */}
      <Card className="overflow-hidden p-0">
        <AnalysisList items={analyses} />
      </Card>
    </div>
  );
}
