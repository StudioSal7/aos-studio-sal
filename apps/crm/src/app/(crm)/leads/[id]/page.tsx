import { notFound } from 'next/navigation';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import {
  getAllStages,
  getLeadById,
  getLeadStageHistory,
  getLeadRespondiRawAnswers,
} from '@/server/queries/leads';
import { getLeadFormResponses } from '@/server/queries/forms';
import { getAnalysesForLead } from '@/server/queries/commercial';
import { getProductById } from '@/server/queries/products';
import { getContractsForLead } from '@/server/queries/contracts';
import {
  buildInstagramLink,
  buildMailtoLink,
  buildWhatsAppLink,
} from '@/server/lib/contact-links/index';
import { Badge } from '@/components/ui/badge';
import { ActivityTimeline } from './_components/activity-timeline';
import { LeadDetailTabs } from './_components/lead-detail-tabs';
import { LeadDossier } from './_components/lead-dossier';
import { LeadNotesForm } from './_components/lead-notes-form';
import { ScheduleMeetingForm } from './_components/schedule-meeting-form';
import { SdrAnalysisButton } from './_components/sdr-analysis-button';
import { GenerateContractSection } from './_components/generate-contract-section';
import { Section, DataRow } from './_components/data-row';

// Porta 1 do SDR puxa a conversa via Evolution + 2 chamadas GPT-4o (síncrono).
export const maxDuration = 300;

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();

  const [history, stages, meetings, formResponses, analyses, respondiAnswers, produtoFechado, contracts] =
    await Promise.all([
      getLeadStageHistory(id),
      getAllStages(),
      db
        .select()
        .from(schema.meetings)
        .where(eq(schema.meetings.leadId, id))
        .orderBy(desc(schema.meetings.scheduledAt)),
      getLeadFormResponses(id),
      getAnalysesForLead(id),
      getLeadRespondiRawAnswers(id),
      lead.produtoFechadoId ? getProductById(lead.produtoFechadoId) : Promise.resolve(null),
      getContractsForLead(id),
    ]);

  const stageMap = new Map(stages.map((s) => [s.id, s]));
  const currentStage = stageMap.get(lead.stageId);

  const mailtoLink = buildMailtoLink(lead.email);
  const whatsappLink = buildWhatsAppLink(lead.whatsappE164);
  const instagramLink = buildInstagramLink(lead.instagramHandle);

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
              {mailtoLink && (
                <a href={mailtoLink} className="hover:text-ink hover:underline">
                  {lead.email}
                </a>
              )}
              {whatsappLink && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink hover:underline"
                >
                  {lead.whatsappE164}
                </a>
              )}
              {instagramLink && (
                <a
                  href={instagramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink hover:underline"
                >
                  @{lead.instagramHandle}
                </a>
              )}
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
        leadId={id}
        atividade={
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <ScheduleMeetingForm leadId={id} />
              <ActivityTimeline
                meetings={meetings}
                stageHistory={history}
                stages={stageMap}
                formResponses={formResponses.map((r) => ({
                  id: r.id,
                  formTitulo: r.formTitulo,
                  concluidoEm: r.concluidoEm,
                }))}
                leadId={id}
              />
            </div>
            <div className="space-y-6">
              <SdrAnalysisButton leadId={id} whatsappE164={lead.whatsappE164} />
              <LeadNotesForm leadId={id} initialNotes={lead.notes ?? ''} />
            </div>
          </div>
        }
        info={
          <LeadDossier
            lead={lead}
            analyses={analyses}
            formResponses={formResponses}
            respondiAnswers={respondiAnswers}
          />
        }
        comercial={
          <div className="max-w-xl space-y-6">
            <Section title="comercial">
              <DataRow label="produto fechado" value={produtoFechado?.displayName ?? null} />
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

            <GenerateContractSection
              leadId={id}
              isPaid={currentStage?.slug === 'paid'}
              contracts={contracts}
            />
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
