// Dossiê do lead — aba "informações". Centraliza, em leitura, TUDO sobre o lead:
// identificação, qualificação (com labels legíveis), origem, dados extraídos das
// calls e as respostas verbatim de todos os formulários que ele preencheu.
// Server Component puro. Edição continua no sidebar da aba "atividade".

import Link from 'next/link';
import { ClipboardCheck, FileText, MessageSquareText } from 'lucide-react';
import type { Lead } from '@repo/db/schema';
import { labelForLeadEnum } from '@/components/forms/lead-mapping-options';
import type { LeadAnalysisSummary } from '@/server/queries/commercial';
import type { LeadFormResponse } from '@/server/queries/forms';
import { Section, DataRow } from './data-row';

export function LeadDossier({
  lead,
  analyses,
  formResponses,
}: {
  lead: Lead;
  analyses: LeadAnalysisSummary[];
  formResponses: LeadFormResponse[];
}) {
  return (
    <div className="space-y-6">
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

        <Section title="qualificação">
          <DataRow label="faixa etária" value={labelForLeadEnum('idadeFaixa', lead.idadeFaixa)} />
          <DataRow
            label="tempo no nicho"
            value={labelForLeadEnum('tempoNoNichoFaixa', lead.tempoNoNichoFaixa)}
          />
          <DataRow
            label="abordagem preferida"
            value={labelForLeadEnum('abordagemPreferida', lead.abordagemPreferida)}
          />
          <DataRow label="renda" value={lead.rendaFaixa} />
          <DataRow label="orçamento" value={lead.orcamentoFaixa} />
          <DataRow label="profissão" value={lead.profissao} />
          <DataRow label="tempo de negócio" value={lead.tempoNegocio} />
          <DataRow label="cliente anterior" value={lead.ehClienteAnterior ? 'sim' : 'não'} />
        </Section>
      </div>

      <Section title="origem">
        <DataRow label="utm source" value={lead.utmSource} />
        <DataRow label="utm medium" value={lead.utmMedium} />
        <DataRow label="utm campaign" value={lead.utmCampaign} />
        <DataRow label="utm term" value={lead.utmTerm} />
        <DataRow label="utm content" value={lead.utmContent} />
        <DataRow label="respondi id" value={lead.intakeRespondentId} />
      </Section>

      <CallDataSection analyses={analyses} />

      <FormResponsesSection responses={formResponses} />
    </div>
  );
}

// ── Dados extraídos das calls ────────────────────────────────────────────────

const CLOSER_FIELDS: { key: string; label: string }[] = [
  { key: 'dor_principal', label: 'dor principal' },
  { key: 'programa_interesse', label: 'programa de interesse' },
  { key: 'orcamento_mencionado', label: 'orçamento mencionado' },
  { key: 'nivel_interesse', label: 'nível de interesse' },
  { key: 'fechou', label: 'fechou' },
  { key: 'proximos_passos', label: 'próximos passos' },
];

const SDR_FIELDS: { key: string; label: string }[] = [
  { key: 'agendou', label: 'agendou' },
  { key: 'data_agendamento', label: 'data do agendamento' },
  { key: 'faixa_renda', label: 'faixa de renda' },
  { key: 'nivel_interesse', label: 'nível de interesse' },
  { key: 'proximos_passos', label: 'próximos passos' },
];

function CallDataSection({ analyses }: { analyses: LeadAnalysisSummary[] }) {
  return (
    <section className="border border-line bg-paper p-6">
      <h2 className="mb-4 text-micro text-ink-muted">dados extraídos das calls</h2>
      {analyses.length === 0 ? (
        <p className="text-body text-ink-muted">Nenhuma análise de call vinculada a este lead.</p>
      ) : (
        <div className="space-y-5">
          {analyses.map((a) => {
            const isCloser = a.analyzer === 'closer';
            const Icon = isCloser ? ClipboardCheck : MessageSquareText;
            const fieldDefs = isCloser ? CLOSER_FIELDS : SDR_FIELDS;
            const dateStr = formatDateOnly(a.callDate);
            return (
              <div key={a.id} className="border-l-2 border-line pl-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-2 text-micro text-ink-muted">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    análise {a.analyzer}
                  </span>
                  <span className="text-micro text-ink-muted normal-case tracking-normal">
                    {dateStr}
                    {a.overallScore != null && ` · ${a.overallScore}/100`}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-body">
                  {fieldDefs.map((f) => (
                    <DataRow key={f.key} label={f.label} value={extractValue(a.extractedData, f.key)} />
                  ))}
                </dl>
                <Link
                  href={`/analise/${a.analyzer}/${a.id}`}
                  className="mt-3 inline-block text-body text-wood underline-offset-2 hover:underline"
                >
                  ver análise completa →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Respostas de formulários ─────────────────────────────────────────────────

function FormResponsesSection({ responses }: { responses: LeadFormResponse[] }) {
  return (
    <section className="border border-line bg-paper p-6">
      <h2 className="mb-4 text-micro text-ink-muted">respostas de formulários</h2>
      {responses.length === 0 ? (
        <p className="text-body text-ink-muted">
          Este lead não preencheu nenhum formulário (ou veio por outra origem).
        </p>
      ) : (
        <div className="space-y-3">
          {responses.map((r) => (
            <details
              key={r.id}
              id={`resp-${r.id}`}
              className="group border border-line bg-canvas/40 open:bg-canvas/60"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-body text-ink marker:content-none">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-ink-muted" aria-hidden />
                  {r.formTitulo}
                </span>
                <span className="text-micro text-ink-muted normal-case tracking-normal">
                  {formatDateTime(r.concluidoEm)}
                </span>
              </summary>
              <dl className="space-y-3 border-t border-line px-4 py-4 text-body">
                {r.answers.length === 0 ? (
                  <p className="text-ink-muted">Resposta sem campos preenchidos.</p>
                ) : (
                  r.answers.map((ans, i) => (
                    <div key={i}>
                      <dt className="text-micro text-ink-muted normal-case tracking-normal">
                        {ans.fieldTitulo}
                      </dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-ink">{ans.value}</dd>
                    </div>
                  ))
                )}
              </dl>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractValue(data: Record<string, unknown> | null, key: string): string | null {
  if (!data) return null;
  const v = data[key];
  if (v == null || v === '') return null;
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  return String(v);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// call_date é um `date` (YYYY-MM-DD) — formata sem timezone para não recuar 1 dia.
function formatDateOnly(d: string): string {
  const [y, m, day] = d.split('-');
  if (y && m && day) return `${day}/${m}/${y}`;
  return d;
}
