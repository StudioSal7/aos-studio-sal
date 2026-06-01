import { getHotLeads, getAllStages } from '@/server/queries/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';

export default async function QuentesPage() {
  const [leads, stages] = await Promise.all([getHotLeads(), getAllStages()]);
  const stageMap = new Map(stages.map((s) => [s.id, s.displayName]));

  return (
    <div className="flex flex-col">
      <PageHeader title={`quentes — próximas 48h (${leads.length}).`} />

      <div className="p-8">
        {leads.length === 0 ? (
          <p className="text-body text-ink-muted">
            Nenhuma ação pendente nas próximas 48h.
          </p>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between border border-line border-l-2 border-l-wood bg-paper px-6 py-4 transition-colors hover:bg-canvas"
              >
                <div>
                  <p className="text-body text-ink">
                    {lead.nickname ?? lead.name}
                  </p>
                  <p className="text-micro text-ink-muted">
                    {stageMap.get(lead.stageId) ?? '—'}
                    {lead.nextActionType && (
                      <span className="ml-2">· {lead.nextActionType}</span>
                    )}
                  </p>
                </div>
                {lead.nextActionAt && (
                  <p className="text-micro text-wood">
                    {formatDistanceToNow(new Date(lead.nextActionAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
