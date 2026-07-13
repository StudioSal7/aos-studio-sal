// Funil de vendas comercial — logo abaixo do KPI hero do dashboard.
// Etapas coletadas (form/reuniões/proposta/venda) mostram número real; posts
// feitos e visualizações geradas (dependem de Meta Ads/GA4, fase posterior)
// aparecem com barra hachurada + tag "em manutenção" pra o funil parecer
// completo na apresentação. Mockup + 5 ajustes aprovados pelo André em 13/07.

import { Card } from '@/components/ui/card';
import { PeriodFilter } from '@/components/ui/period-filter';
import { DATE_RANGE_OPTIONS, type DateRangeOption } from '@/server/lib/date-range/index';
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
  | { label: string; kind: 'collected' | 'won'; value: number };

function FunnelRow({
  stage,
  widthPct,
  conversionPct,
}: {
  stage: FunnelStage;
  widthPct: number;
  conversionPct: number | null;
}) {
  const isMaintenance = stage.kind === 'maintenance';

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
        <p className="ml-[166px] mt-0.5 text-[11px] normal-case tracking-normal text-ink-muted">
          ↓ {conversionPct}% avançam
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
  range,
  ttfc,
}: {
  counts: CommercialFunnelCounts;
  range: DateRangeOption;
  ttfc: { medianSeconds: number | null; withinSlaPct: number | null; count: number };
}) {
  const stages: FunnelStage[] = [
    { label: 'posts feitos', kind: 'maintenance' },
    { label: 'visualizações geradas', kind: 'maintenance' },
    { label: 'formulários enviados', kind: 'collected', value: counts.formResponses },
    { label: 'reuniões agendadas', kind: 'collected', value: counts.meetingsScheduled },
    { label: 'reuniões comparecidas', kind: 'collected', value: counts.meetingsAttended },
    { label: 'propostas realizadas', kind: 'collected', value: counts.proposalsSent },
    { label: 'vendas feitas', kind: 'won', value: counts.salesWon },
  ];

  const collectedValues = stages
    .filter((s): s is Extract<FunnelStage, { kind: 'collected' | 'won' }> => s.kind !== 'maintenance')
    .map((s) => s.value);
  const maxValue = Math.max(1, ...collectedValues);

  let prevCollected: number | null = null;

  return (
    <section>
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h2 className="text-h3 text-ink">funil de vendas.</h2>
        <PeriodFilter current={range} options={DATE_RANGE_OPTIONS} />
      </div>

      <div className="min-w-0 space-y-2 overflow-hidden pt-6">
        {stages.map((stage) => {
          const widthPct = stage.kind === 'maintenance' ? 100 : Math.max(4, Math.round((stage.value / maxValue) * 100));
          let conversionPct: number | null = null;
          if (stage.kind !== 'maintenance') {
            if (prevCollected != null && prevCollected > 0) {
              conversionPct = Math.round((stage.value / prevCollected) * 100);
            }
            prevCollected = stage.value;
          }
          return <FunnelRow key={stage.label} stage={stage} widthPct={widthPct} conversionPct={conversionPct} />;
        })}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 [&>*]:min-w-0">
        <Card className="min-w-0 overflow-hidden">
          <p className="text-micro text-ink-muted">tempo médio de primeiro atendimento</p>
          <p className="mt-3 break-words text-[26px] font-serif normal-case leading-[1.15] tracking-tight text-ink">
            {ttfc.medianSeconds != null ? formatDuration(ttfc.medianSeconds) : '—'}
          </p>
          <p className="mt-1 text-micro text-ink-muted">
            {ttfc.count > 0
              ? `mediana · ${ttfc.withinSlaPct}% em 24h · base ${ttfc.count}`
              : 'sem dados no período'}
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
