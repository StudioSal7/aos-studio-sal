import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';

export default async function SaudePage() {
  const leads = await db
    .select({
      id: schema.leads.id,
      name: schema.leads.name,
      nickname: schema.leads.nickname,
      requiresAttentionReason: schema.leads.requiresAttentionReason,
      stageId: schema.leads.stageId,
      stageDisplayName: schema.leadStages.displayName,
      updatedAt: schema.leads.updatedAt,
    })
    .from(schema.leads)
    .leftJoin(schema.leadStages, eq(schema.leads.stageId, schema.leadStages.id))
    .where(and(isNull(schema.leads.deletedAt), eq(schema.leads.requiresAttention, true)))
    .orderBy(desc(schema.leads.updatedAt))
    .limit(100);

  return (
    <div className="flex flex-col">
      <PageHeader title={`saúde dos dados (${leads.length}).`} />

      <div className="p-8">
        {leads.length === 0 ? (
          <p className="text-body text-ink-muted">
            Nenhum lead com atenção pendente. Ótimo!
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
                    {lead.nickname ?? lead.name ?? 'Sem nome'}
                  </p>
                  <p className="text-micro text-ink-muted">
                    {lead.stageDisplayName} — {lead.requiresAttentionReason ?? 'Atenção necessária'}
                  </p>
                </div>
                <p className="text-micro text-ink-muted">
                  {formatDistanceToNow(new Date(lead.updatedAt), {
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
