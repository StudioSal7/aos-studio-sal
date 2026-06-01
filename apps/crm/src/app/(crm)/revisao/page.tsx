import { getManualReviewLeads, getAllStages } from '@/server/queries/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';

export default async function RevisaoPage() {
  const [leads, stages] = await Promise.all([
    getManualReviewLeads(),
    getAllStages(),
  ]);
  const stageMap = new Map(stages.map((s) => [s.id, s.displayName]));

  return (
    <div className="flex flex-col">
      <PageHeader title={`para revisão (${leads.length}).`} />

      <div className="p-8">
        {leads.length === 0 ? (
          <p className="text-body text-ink-muted">
            Nenhum lead aguardando revisão manual.
          </p>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between border border-line border-l-2 border-l-signal-review bg-paper px-6 py-4 transition-colors hover:bg-canvas"
              >
                <div className="min-w-0">
                  <p className="text-body text-ink">
                    {lead.nickname ?? lead.name}
                  </p>
                  <p className="truncate text-micro text-ink-muted">
                    {lead.manualReviewReason ?? stageMap.get(lead.stageId)}
                  </p>
                  {(lead.email ?? lead.whatsappE164) && (
                    <p className="text-micro text-ink-muted normal-case tracking-normal">
                      {lead.email ?? lead.whatsappE164}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-micro text-ink-muted">
                  {formatDistanceToNow(new Date(lead.createdAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
