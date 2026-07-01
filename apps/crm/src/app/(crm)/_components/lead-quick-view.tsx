'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScheduleMeetingForm } from '@/app/(crm)/leads/[id]/_components/schedule-meeting-form';
import { labelForLeadEnum } from '@/components/forms/lead-mapping-options';
import type { KanbanLead, KanbanStage } from './kanban-board';

export function LeadQuickView({
  lead,
  stage,
  onClose,
}: {
  lead: KanbanLead | null;
  stage: KanbanStage | undefined;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" width="md">
        {lead && (
          <>
            <SheetHeader>
              <SheetTitle>
                {lead.nickname ?? lead.name ?? 'sem nome'}.
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {stage && (
                  <Badge variant="neutral">
                    {stage.displayName.toLowerCase()}
                  </Badge>
                )}
                {lead.needsManualReview && (
                  <Badge variant="review">revisão manual</Badge>
                )}
                {lead.requiresAttention && <Badge variant="hot">atenção</Badge>}
                {lead.hasUnconfirmedMeeting && (
                  <Badge variant="hot">confirmar reunião</Badge>
                )}
                {lead.marcadoFake && <Badge variant="fake">fake</Badge>}
                {lead.ehClienteAnterior && (
                  <Badge variant="archive">cliente anterior</Badge>
                )}
              </div>
            </SheetHeader>

            <SheetBody>
              <div className="space-y-6">
                <Section title="contato">
                  <DataRow label="nome completo" value={lead.name} />
                  <DataRow label="e-mail" value={lead.email} />
                  <DataRow label="whatsapp" value={lead.whatsappE164} />
                </Section>

                {(lead.abordagemPreferida ||
                  lead.idadeFaixa ||
                  lead.tempoNoNichoFaixa ||
                  lead.rendaFaixa ||
                  lead.orcamentoFaixa ||
                  lead.profissao) && (
                  <Section title="como abordar">
                    <DataRow
                      label="abordagem"
                      value={labelForLeadEnum('abordagemPreferida', lead.abordagemPreferida)}
                    />
                    <DataRow
                      label="faixa etária"
                      value={labelForLeadEnum('idadeFaixa', lead.idadeFaixa)}
                    />
                    <DataRow
                      label="tempo no nicho"
                      value={labelForLeadEnum('tempoNoNichoFaixa', lead.tempoNoNichoFaixa)}
                    />
                    <DataRow label="renda" value={lead.rendaFaixa} />
                    <DataRow label="orçamento" value={lead.orcamentoFaixa} />
                    {lead.profissao && (
                      <div className="grid grid-cols-[120px_1fr] gap-3 py-1 text-body">
                        <span className="text-ink-muted normal-case tracking-normal">
                          profissão
                        </span>
                        <span className="line-clamp-4 text-ink">{lead.profissao}</span>
                      </div>
                    )}
                  </Section>
                )}

                {lead.nextActionAt && (
                  <Section title="próxima ação">
                    <p className="text-body text-ink">
                      {formatBrt(lead.nextActionAt)}
                      {lead.nextActionType && (
                        <span className="ml-2 text-ink-muted">
                          — {lead.nextActionType}
                        </span>
                      )}
                    </p>
                  </Section>
                )}

                <Section title="agendar reunião">
                  <ScheduleMeetingForm leadId={lead.id} />
                </Section>
              </div>
            </SheetBody>

            <SheetFooter>
              <Button variant="ghost" size="sm" onClick={onClose}>
                fechar
              </Button>
              <Link
                href={`/leads/${lead.id}`}
                className="inline-flex items-center justify-center bg-ink px-4 py-2 text-btn text-paper transition-colors duration-300 hover:bg-ink-hover"
              >
                abrir detalhe completo
              </Link>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
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
    <section>
      <h3 className="mb-2 text-micro text-ink-muted">{title}</h3>
      {children}
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
  if (!value) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-1 text-body">
      <span className="text-ink-muted normal-case tracking-normal">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function formatBrt(iso: string): string {
  const zoned = toZonedTime(new Date(iso), 'America/Sao_Paulo');
  return format(zoned, "dd/MM 'às' HH:mm");
}
