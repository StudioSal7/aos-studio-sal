import {
  getDataQuality,
  getPipelineCounts,
  getTimeToFirstContact,
} from '@/server/queries/dashboard';
import { computeFirstContactMetric } from '@/server/lib/first-contact-metric';
import { getCommercialFunnelCounts, getWeeklyFunnel } from '@/server/queries/commercial-funnel';
import { getMetricTargets } from '@/server/queries/metric-targets';
import { resolveDashboardPeriod } from '@/server/lib/date-range/index';
import { conversionPct } from '@/server/lib/week-range/conversion';
import {
  evaluateMetric,
  trafficLightGlyph,
  type TrafficLight,
} from '@/server/lib/metric-target-evaluator/index';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { CHART_COLORS } from '@/components/charts/chart-theme';
import { HorizontalBarChart } from '@/components/charts/horizontal-bar-chart';
import { CommercialFunnelSection } from './_components/commercial-funnel-section';
import { WeeklyMetricsGrid } from './_components/weekly-metrics-grid';
import { DashboardPeriodFilter } from './_components/dashboard-period-filter';

// Dashboard lê dados vivos por trás do auth — nunca deve ser pré-renderizado no
// build. Sem isto, o Next tenta exportar /dashboard no build e executa as queries
// sem o ambiente de runtime, quebrando o deploy.
export const dynamic = 'force-dynamic';

// O dashboard agrega as queries num único render server-side. O default de
// execução da Vercel (~15s) já estourou aqui (504 FUNCTION_INVOCATION_TIMEOUT)
// quando a evolução semanal fazia 32 round-trips; hoje são ~10 round-trips
// (pipeline 1 + qualidade 1 + funil 3 + ttfc 1 + semanal 3 + metas 1).
// maxDuration=60 é folga defensiva contra picos de latência do banco — não
// substitui manter o nº de queries baixo (pool max:10).
export const maxDuration = 60;

// Grid semanal fixo em 6 semanas fechadas — independe do seletor de período.
const GRID_WEEKS = 6;

function formatDuration(seconds: string | number | null): string {
  if (seconds == null) return '—';
  const s = Number(seconds);
  if (s < 3600) return `${Math.round(s / 60)}min`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

// A query já filtra ambos NOT NULL, mas guardamos aqui contra null/tipo
// inesperado (o driver pode devolver string p/ timestamptz) — new Date()
// aceita Date e string, sem depender de non-null assertion.
function ttfcDurationsFromRows(
  rows: { firstContactAt: Date | string | null; applicationReceivedAt: Date | string | null }[],
): number[] {
  return rows
    .map((r) => {
      if (!r.firstContactAt || !r.applicationReceivedAt) return null;
      const fc = new Date(r.firstContactAt).getTime();
      const ar = new Date(r.applicationReceivedAt).getTime();
      if (Number.isNaN(fc) || Number.isNaN(ar)) return null;
      return (fc - ar) / 1000;
    })
    .filter((d): d is number => d !== null);
}

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function colorForStageKind(kind: string | null): string {
  if (kind === 'won') return CHART_COLORS.won;
  if (kind === 'lost') return CHART_COLORS.lost;
  return CHART_COLORS.open;
}

const TEXT_BY_STATUS: Record<TrafficLight, string> = {
  green: 'text-leaf',
  yellow: 'text-wood',
  red: 'text-clay',
  gray: 'text-ink',
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const period = resolveDashboardPeriod(params);

  const [pipelineCounts, quality, funnelCounts, ttfcRows, weeklyFunnel, targets] =
    await Promise.all([
      getPipelineCounts(),
      getDataQuality(),
      getCommercialFunnelCounts(period.range),
      getTimeToFirstContact(period.range),
      getWeeklyFunnel(GRID_WEEKS),
      getMetricTargets(),
    ]);

  const ttfc = computeFirstContactMetric(ttfcDurationsFromRows(ttfcRows));

  const totalLeads = pipelineCounts.reduce((sum, s) => sum + Number(s.count), 0);

  // Snapshot "agora": leads paradas em Aplicação recebida. Filtro por SLUG
  // (imutável) — displayName é editável pelo owner e já quebrou este KPI.
  const naoTrabalhadas = pipelineCounts
    .filter((s) => s.stageSlug === 'application_received')
    .reduce((sum, s) => sum + Number(s.count), 0);

  // Conversão global do PERÍODO: vendas ÷ leads entrados (fluxo, não snapshot).
  const convGlobal = conversionPct(funnelCounts.leadsEntered, funnelCounts.salesWon);
  const convGlobalStatus = evaluateMetric(convGlobal, targets.get('conv_global') ?? null);

  const ttfcMedianHours = ttfc.medianSeconds !== null ? ttfc.medianSeconds / 3600 : null;
  const ttfcStatus = evaluateMetric(ttfcMedianHours, targets.get('ttfc_median_hours') ?? null);
  const ttfcSlaStatus = evaluateMetric(
    ttfc.withinSlaPct,
    targets.get('ttfc_within_24h_pct') ?? null,
  );
  const ttfcSlaGlyph = trafficLightGlyph(ttfcSlaStatus);

  // Funil por status para HorizontalBarChart (snapshot de agora)
  const funilData = pipelineCounts.map((row) => ({
    label: row.stageDisplayName ?? '(sem nome)',
    value: Number(row.count),
    color: colorForStageKind(row.stageKind),
  }));

  return (
    <div className="flex flex-col">
      <PageHeader title="dashboard.">
        <DashboardPeriodFilter
          current={period.option}
          label={period.label}
          customFrom={params.from}
          customTo={params.to}
        />
      </PageHeader>

      <div className="space-y-10 p-8">
        {/* KPI hero — métricas do período selecionado (+ 1 snapshot rotulado) */}
        <div className="grid grid-cols-5 gap-4 [&>*]:min-w-0">
          <KpiCard
            label="leads entrados"
            value={funnelCounts.leadsEntered}
            note={period.label}
          />
          <KpiCard
            label="vendas no período"
            value={funnelCounts.salesWon}
            note="cards movidos para pago"
          />
          <KpiCard
            label="conversão global"
            value={convGlobal !== null ? `${convGlobal}%` : '—'}
            note={
              convGlobal !== null
                ? `vendas ÷ leads entrados (${funnelCounts.salesWon} de ${funnelCounts.leadsEntered})`
                : 'sem leads no período'
            }
            status={convGlobalStatus}
          />
          <KpiCard
            label="tempo até 1º contato"
            value={ttfc.medianSeconds !== null ? formatDuration(ttfc.medianSeconds) : '—'}
            note={
              ttfc.count > 0 ? (
                <>
                  mediana ·{' '}
                  {ttfcSlaGlyph && (
                    <span className={TEXT_BY_STATUS[ttfcSlaStatus]}>{ttfcSlaGlyph} </span>
                  )}
                  {ttfc.withinSlaPct}% em 24h · base {ttfc.count}
                </>
              ) : (
                'sem dados no período'
              )
            }
            status={ttfcStatus}
          />
          <KpiCard
            label="não trabalhadas (agora)"
            value={naoTrabalhadas}
            note={`${pct(naoTrabalhadas, totalLeads)}% do total · snapshot, ignora o período`}
          />
        </div>

        {/* Funil de vendas — fluxo do período selecionado */}
        <CommercialFunnelSection
          counts={funnelCounts}
          ttfc={ttfc}
          targets={targets}
          periodLabel={period.label}
        />

        {/* Grid semanal transposto — visão principal de tendência (6 semanas fixas) */}
        <WeeklyMetricsGrid weeks={weeklyFunnel} targets={targets} />

        {/* Snapshots de agora — não respondem ao seletor de período */}
        <div className="grid grid-cols-2 gap-8 [&>*]:min-w-0">
          <section>
            <h2 className="text-h3 text-ink">funil por status (agora).</h2>
            <p className="mb-5 mt-1 text-micro text-ink-muted">
              Estado real de cada lead neste momento. {naoTrabalhadas} leads ainda esperando
              contato inicial.
            </p>
            <Card className="min-w-0 overflow-hidden">
              <HorizontalBarChart data={funilData} yAxisWidth={180} height={320} />
            </Card>
          </section>

          <section>
            <h2 className="text-h3 text-ink">qualidade dos dados.</h2>
            <p className="mb-5 mt-1 text-micro text-ink-muted">
              Preenchimento dos campos críticos na base inteira ({totalLeads} leads).
            </p>
            <Card className="space-y-4">
              {[
                { label: 'E-mail', value: Number(quality.comEmail) },
                { label: 'WhatsApp', value: Number(quality.comWhatsapp) },
                { label: 'Instagram', value: Number(quality.comInstagram) },
                { label: 'Pontuação', value: Number(quality.comPontuacao) },
                { label: 'Renda', value: Number(quality.comRenda) },
                { label: 'Orçamento', value: Number(quality.comOrcamento) },
              ].map(({ label, value }) => {
                const p = pct(value, totalLeads);
                return (
                  <div key={label} className="space-y-1.5">
                    <div className="flex justify-between text-micro">
                      <span className="text-ink">{label}</span>
                      <span className="text-ink-muted">
                        {value} / {totalLeads} ({p}%)
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
                      <div
                        className="h-1.5 rounded-full bg-ink transition-all"
                        style={{ width: `${p}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  note,
  status,
}: {
  label: string;
  value: string | number;
  note?: React.ReactNode;
  status?: TrafficLight;
}) {
  const glyph = status ? trafficLightGlyph(status) : '';
  const valueColor = status ? TEXT_BY_STATUS[status] : 'text-ink';
  return (
    <Card className="min-w-0 overflow-hidden">
      <p className="text-micro text-ink-muted">{label}</p>
      <p className={`mt-3 break-words text-h2 ${valueColor}`}>
        {glyph && <span className="mr-1.5 text-[18px] align-middle">{glyph}</span>}
        {value}
      </p>
      {note && <p className="mt-1 text-micro text-ink-muted">{note}</p>}
    </Card>
  );
}
