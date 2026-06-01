import { notFound } from 'next/navigation';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import {
  getAllStages,
  getLeadById,
  getLeadStageHistory,
} from '@/server/queries/leads';
import { Badge } from '@/components/ui/badge';
import { ActivityTimeline } from './_components/activity-timeline';
import { LeadDetailTabs } from './_components/lead-detail-tabs';
import { LeadNotesForm } from './_components/lead-notes-form';
import { ScheduleMeetingForm } from './_components/schedule-meeting-form';

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();

  const [history, stages, meetings] = await Promise.all([
    getLeadStageHistory(id),
    getAllStages(),
    db
      .select()
      .from(schema.meetings)
      .where(eq(schema.meetings.leadId, id))
      .orderBy(desc(schema.meetings.scheduledAt)),
  ]);

  const stageMap = new Map(stages.map((s) => [s.id, s]));
  const currentStage = stageMap.get(lead.stageId);

  return (
    <div className="flex flex-col">
      <header className="flex flex-col gap-3 border-b border-line bg-paper px-8 py-5">
        <Link
          href="/kanban"
          className="text-micro text-ink-muted normal-case tracking-normal hover:text-ink"
        >
          ← pipeline
        </Link>

        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-h2 text-ink">
              {lead.nickname ?? lead.name ?? 'sem nome'}.
            </h1>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-body text-ink-muted">
              {lead.email && <span>{lead.email}</span>}
              {lead.whatsappE164 && <span>{lead.whatsappE164}</span>}
              {lead.instagramHandle && <span>@{lead.instagramHandle}</span>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentStage && (
              <Badge variant="neutral">{currentStage.displayName.toLowerCase()}</Badge>
            )}
            {lead.needsManualReview && <Badge variant="review">revisão manual</Badge>}
            {lead.requiresAttention && <Badge variant="hot">atenção</Badge>}
            {lead.marcadoFake && <Badge variant="fake">fake</Badge>}
            {lead.ehClienteAnterior && (
              <Badge variant="archive">cliente anterior</Badge>
            )}
          </div>
        </div>
      </header>

      <LeadDetailTabs
        atividade={
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <ScheduleMeetingForm leadId={id} />
              <ActivityTimeline
                meetings={meetings}
                stageHistory={history}
                stages={stageMap}
                leadId={id}
              />
            </div>
            <div>
              <LeadNotesForm leadId={id} initialNotes={lead.notes ?? ''} />
            </div>
          </div>
        }
        info={
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="identificação">
              <DataRow label="nome completo" value={lead.name} />
              <DataRow label="apelido" value={lead.nickname} />
              <DataRow label="e-mail" value={lead.email} />
              <DataRow label="whatsapp" value={lead.whatsappE164} />
              <DataRow label="instagram" value={lead.instagramHandle} />
              <DataRow label="cidade" value={lead.cidade} />
              <DataRow label="estado" value={lead.estado} />
            </Section>
            <Section title="origem">
              <DataRow label="utm source" value={lead.utmSource} />
              <DataRow label="utm medium" value={lead.utmMedium} />
              <DataRow label="utm campaign" value={lead.utmCampaign} />
              <DataRow label="utm term" value={lead.utmTerm} />
              <DataRow label="utm content" value={lead.utmContent} />
              <DataRow label="respondi id" value={lead.intakeRespondentId} />
            </Section>
          </div>
        }
        comercial={
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="qualificação">
              <DataRow label="faixa etária" value={lead.idadeFaixa} />
              <DataRow label="tempo no nicho" value={lead.tempoNoNichoFaixa} />
              <DataRow
                label="abordagem preferida"
                value={lead.abordagemPreferida}
              />
              <DataRow label="renda" value={lead.rendaFaixa} />
              <DataRow label="orçamento" value={lead.orcamentoFaixa} />
              <DataRow label="profissão" value={lead.profissao} />
              <DataRow label="tempo de negócio" value={lead.tempoNegocio} />
              <DataRow
                label="cliente anterior"
                value={lead.ehClienteAnterior ? 'sim' : 'não'}
              />
            </Section>
            <Section title="comercial">
              <DataRow
                label="valor proposto"
                value={lead.valorProposto ? `R$ ${lead.valorProposto}` : null}
              />
              <DataRow
                label="forma de pagamento"
                value={lead.formaPagamentoNegociada}
              />
              <DataRow
                label="próxima ação"
                value={
                  lead.nextActionAt
                    ? new Date(lead.nextActionAt).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : null
                }
              />
              <DataRow label="tipo da próxima ação" value={lead.nextActionType} />
              <DataRow label="notas próxima ação" value={lead.nextActionNotes} />
            </Section>
          </div>
        }
        historico={
          <div className="max-w-2xl">
            {history.length === 0 ? (
              <p className="text-body text-ink-muted">Sem histórico de estágios.</p>
            ) : (
              <ol className="space-y-2">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between gap-4 border-b border-line py-2 text-body text-ink"
                  >
                    <span>
                      {stageMap.get(h.fromStageId ?? '')?.displayName ?? '—'} →{' '}
                      <span className="font-medium">
                        {stageMap.get(h.toStageId)?.displayName ?? '?'}
                      </span>
                    </span>
                    <span className="text-micro text-ink-muted normal-case tracking-normal">
                      {new Date(h.changedAt).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        }
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line bg-paper p-6">
      <h2 className="mb-4 text-micro text-ink-muted">{title}</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-body">{children}</dl>
    </section>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">
        {value ?? <span className="text-ink-muted">—</span>}
      </dd>
    </>
  );
}
