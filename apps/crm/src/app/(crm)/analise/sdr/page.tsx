import { requireAuth } from '@/server/auth';
import { listAnalyses, getAnalysisKpis } from '@/server/queries/commercial';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { AnalysisList } from '../closer/_components/analysis-list';
import { SdrChatList } from './_components/sdr-chat-list';

// A Porta 2 dispara análise (pull + 2 GPT-4o) via server action a partir do client.
export const maxDuration = 300;

export default async function SdrAnalysisPage() {
  await requireAuth();

  const [analyses, kpis] = await Promise.all([listAnalyses('sdr'), getAnalysisKpis('sdr')]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="análise sdr." />

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
          <p className="text-micro text-ink-muted">agendamentos</p>
          <p className="mt-1 text-display">{kpis.closedCount ?? '—'}</p>
        </Card>
      </div>

      {/* Porta 2: conversas da instância */}
      <section className="space-y-3">
        <h2 className="text-h3 text-ink">conversas no whatsapp</h2>
        <p className="text-micro text-ink-muted normal-case tracking-normal">
          escolha uma conversa para puxar e analisar. conversas casadas com um lead aparecem marcadas.
        </p>
        <Card className="p-4">
          <SdrChatList />
        </Card>
      </section>

      {/* Análises já feitas */}
      <section className="space-y-3">
        <h2 className="text-h3 text-ink">análises realizadas</h2>
        <Card className="overflow-hidden p-0">
          <AnalysisList items={analyses} basePath="/analise/sdr" />
        </Card>
      </section>
    </div>
  );
}
