// Funil de vendas comercial — logo abaixo do KPI hero do dashboard.
// Etapas coletadas (form/reuniões/proposta/venda) mostram número real; posts
// feitos e visualizações geradas (dependem de Meta Ads/GA4, fase posterior)
// aparecem com barra hachurada + tag "em manutenção" pra o funil parecer
// completo na apresentação.
//
// O período vem do seletor no topo da página (via props counts/ttfc já
// filtrados + periodLabel). As taxas "% avançam" cujo par de etapas tem chave
// no metric-registry ganham semáforo por meta (form → agendada pula etapas do
// kanban e fica neutra de propósito — não inventar chave).

import { Card } from '@/components/ui/card';
import {
  evaluateMetric,
  trafficLightGlyph,
  type MetricTargetInput,
  type TrafficLight,
} from '@/server/lib/metric-target-evaluator/index';
import type { MetricKey } from '@/server/lib/metric-registry/index';
import { weeklyConversions } from '@/server/lib/week-range/conversion';
import type { CommercialFunnelCounts } from '@/server/queries/commercial-funnel';

function MaintenanceTag() {
  return (
    <span className="shrink-0 whitespace-nowrap bg-clay/10 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-clay">
      em manutenção
    </span>
  );
}

type FunnelStage =
  | { label: string; kind: 'maintenance' }
  | {
      label: string;
      kind: 'collected' | 'won';
      value: number;
      // Chave do registry para a transição etapa_anterior → esta etapa.
      conversionKey?: MetricKey;
    };

const TEXT_BY_STATUS: Record<TrafficLight, string> = {
  green: 'text-leaf',
  yellow: 'text-wood',
  red: 'text-clay',
  gray: 'text-ink-muted',
};

function FunnelRow({
  stage,
  widthPct,
  conversionPct,
  conversionStatus,
}: {
  stage: FunnelStage;
  widthPct: number;
  conversionPct: number | null;
  conversionStatus: TrafficLight;
}) {
  const isMaintenance = stage.kind === 'maintenance';
  const glyph = trafficLightGlyph(conversionStatus);

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="w-[150px] shrink-0 text-right text-[12px] normal-case tracking-normal text-ink-muted">
          {stage.label}
        </div>
        <div className="h-[34px] min-w-0 flex-1 overflow-hidden bg-canvas">
          <div
            className="h-full"
            style={
              isMaintenance
                ? {
                    width: '100%',
                    backgroundImage:
                      'repeating-linear-gradient(45deg, var(--color-line) 0, var(--color-line) 6px, transparent 6px, transparent 12px)',
                  }
                : {
                    width: `${widthPct}%`,
                    backgroundColor: stage.kind === 'won' ? 'var(--color-leaf)' : 'var(--color-wood)',
                  }
            }
          />
        </div>
        <div className="w-[110px] shrink-0 text-right">
          {isMaintenance ? (
            <MaintenanceTag />
          ) : (
            <span className="font-serif text-[19px] normal-case tabular-nums text-ink">
              {stage.value}
            </span>
          )}
        </div>
      </div>
      {conversionPct != null && (
        <p
          className={`ml-[166px] mt-0.5 text-[11px] normal-case tracking-normal ${TEXT_BY_STATUS[conversionStatus]}`}
        >
          {glyph && <span className="mr-1 text-[10px]">{glyph}</span>}↓ {conversionPct}% avançam
        </p>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export function CommercialFunnelSection({
  counts,
  ttfc,
  targets,
  periodLabel,
}: {
  counts: CommercialFunnelCounts;
  ttfc: { medianSeconds: number | null; withinSlaPct: number | null; count: number };
  targets: Map<string, MetricTargetInput>;
  periodLabel: string;
}) {
  const stages: FunnelStage[] = [
    { label: 'posts feitos', kind: 'maintenance' },
    { label: 'visualizações geradas', kind: 'maintenance' },
    { label: 'formulários enviados', kind: 'collected', value: counts.formResponses },
    { label: 'reuniões agendadas', kind: 'collected', value: counts.meetingsScheduled },
    {
      label: 'reuniões comparecidas',
      kind: 'collected',
      value: counts.meetingsAttended,
      conversionKey: 'show_rate',
    },
    {
      label: 'propostas realizadas',
      kind: 'collected',
      value: counts.proposalsSent,
      conversionKey: 'conv_meeting_to_proposal',
    },
    {
      label: 'vendas feitas',
      kind: 'won',
      value: counts.salesWon,
      conversionKey: 'conv_proposal_to_sale',
    },
  ];

  const collectedValues = stages
    .filter((s): s is Extract<FunnelStage, { kind: 'collected' | 'won' }> => s.kind !== 'maintenance')
    .map((s) => s.value);
  const maxValue = Math.max(1, ...collectedValues);
  // Taxas entre etapas coletadas adjacentes — mesma fórmula do grid semanal
  // (week-range/conversion), pra não divergir se o arredondamento/tratamento
  // de denominador 0 mudar lá. Comprimento = collectedValues.length - 1.
  const collectedConversions = weeklyConversions(collectedValues);

  const ttfcMedianHours = ttfc.medianSeconds != null ? ttfc.medianSeconds / 3600 : null;
  const ttfcStatus = evaluateMetric(ttfcMedianHours, targets.get('ttfc_median_hours') ?? null);
  const ttfcSlaStatus = evaluateMetric(ttfc.withinSlaPct, targets.get('ttfc_within_24h_pct') ?? null);
  const ttfcSlaGlyph = trafficLightGlyph(ttfcSlaStatus);

  let collectedIndex = -1;

  return (
    <section>
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h2 className="text-h3 text-ink">funil de vendas.</h2>
        <span className="text-micro text-ink-muted">{periodLabel}</span>
      </div>

      <div className="min-w-0 space-y-2 overflow-hidden pt-6">
        {stages.map((stage) => {
          const widthPct = stage.kind === 'maintenance' ? 100 : Math.max(4, Math.round((stage.value / maxValue) * 100));
          let stageConversionPct: number | null = null;
          let conversionStatus: TrafficLight = 'gray';
          if (stage.kind !== 'maintenance') {
            collectedIndex += 1;
            if (collectedIndex > 0) {
              stageConversionPct = collectedConversions[collectedIndex - 1] ?? null;
              if (stage.conversionKey && stageConversionPct !== null) {
                conversionStatus = evaluateMetric(
                  stageConversionPct,
                  targets.get(stage.conversionKey) ?? null,
                );
              }
            }
          }
          return (
            <FunnelRow
              key={stage.label}
              stage={stage}
              widthPct={widthPct}
              conversionPct={stageConversionPct}
              conversionStatus={conversionStatus}
            />
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 [&>*]:min-w-0">
        <Card className="min-w-0 overflow-hidden">
          <p className="text-micro text-ink-muted">leads que entraram no período</p>
          <p className="mt-3 break-words text-[26px] font-serif normal-case leading-[1.15] tracking-tight text-ink">
            {counts.leadsEntered}
          </p>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <p className="text-micro text-ink-muted">tempo médio de primeiro atendimento</p>
          <p
            className={`mt-3 break-words text-[26px] font-serif normal-case leading-[1.15] tracking-tight ${
              ttfcStatus === 'gray' ? 'text-ink' : TEXT_BY_STATUS[ttfcStatus]
            }`}
          >
            {trafficLightGlyph(ttfcStatus) && (
              <span className="mr-1.5 text-[14px]">{trafficLightGlyph(ttfcStatus)}</span>
            )}
            {ttfc.medianSeconds != null ? formatDuration(ttfc.medianSeconds) : '—'}
          </p>
          <p className="mt-1 text-micro text-ink-muted">
            {ttfc.count > 0 ? (
              <>
                mediana ·{' '}
                {ttfcSlaGlyph && (
                  <span className={`text-[10px] ${TEXT_BY_STATUS[ttfcSlaStatus]}`}>
                    {ttfcSlaGlyph}{' '}
                  </span>
                )}
                {ttfc.withinSlaPct}% em 24h · base {ttfc.count}
              </>
            ) : (
              'sem dados no período'
            )}
          </p>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center gap-2">
            <p className="text-micro text-ink-muted">quantidade de follow-up por lead</p>
            <MaintenanceTag />
          </div>
          <p className="mt-3 text-[26px] font-serif normal-case leading-[1.15] tracking-tight text-ink-muted">—</p>
          <p className="mt-1 text-micro text-ink-muted">aguarda base de mensagens</p>
        </Card>
      </div>
    </section>
  );
}
