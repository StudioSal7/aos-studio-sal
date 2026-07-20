import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getPipelineCounts,
  getAvgTimePerStage,
  getRecentActivity,
  getDataQuality,
  getLeadsByMonth,
  getLeadsByRenda,
  getLeadsByOrcamento,
  getPontuacaoVsEngajamento,
  getConversaoPorFonte,
  getTotalLeadsBySource,
  getTimeToFirstContact,
} from '@/server/queries/dashboard';
import { computeFirstContactMetric } from '@/server/lib/first-contact-metric';
import { getCommercialFunnelCounts, getWeeklyFunnel } from '@/server/queries/commercial-funnel';
import {
  DEFAULT_DATE_RANGE,
  isDateRangeOption,
  resolveDateRange,
} from '@/server/lib/date-range/index';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { CHART_COLORS } from '@/components/charts/chart-theme';
import { HorizontalBarChart } from '@/components/charts/horizontal-bar-chart';
import { StackedBarChart } from '@/components/charts/stacked-bar-chart';
import { DonutChart } from '@/components/charts/donut-chart';
import { DualAxisChart } from '@/components/charts/dual-axis-chart';
import { CommercialFunnelSection } from './_components/commercial-funnel-section';
import { WeeklyFunnelSection } from './_components/weekly-funnel-section';

// Dashboard lê dados vivos por trás do auth — nunca deve ser pré-renderizado no
// build. Sem isto, o Next tenta exportar /dashboard no build e executa as queries
// sem o ambiente de runtime, quebrando o deploy.
export const dynamic = 'force-dynamic';

// O dashboard agrega muitas queries (pipeline, funil, evolução semanal, KPIs)
// num único render server-side. O default de execução da Vercel (~15s) já
// estourou aqui (504 FUNCTION_INVOCATION_TIMEOUT) quando a evolução semanal
// fazia 32 round-trips; isso foi resolvido colapsando-a em 3 queries agrupadas
// (ver getWeeklyFunnel). maxDuration=60 é folga defensiva contra picos de
// latência do banco — não substitui manter o nº de queries baixo.
export const maxDuration = 60;

// Extrai o valor mínimo implícito de um label de renda/orçamento para ordenação crescente.
function extractMinValue(label: string): number {
  const lower = label.toLowerCase();
  if (lower.startsWith('até') || lower.startsWith('menos de')) return 0;
  const clean = label.replace(/\./g, ''); // remove separador de milhar brasileiro
  const match = clean.match(/\d+/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return parseInt(match[0], 10);
}

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

const MONTH_LABELS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

function formatMonth(ym: string): string {
  // input "2025-07"
  const [year, month] = ym.split('-');
  const m = Number(month) - 1;
  const yy = year?.slice(-2) ?? '';
  return `${MONTH_LABELS[m]}/${yy}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const rangeOption = isDateRangeOption(params.range) ? params.range : DEFAULT_DATE_RANGE;
  const range = resolveDateRange(rangeOption);

  const [
    pipelineCounts,
    avgTimes,
    recentActivity,
    quality,
    byMonth,
    byRenda,
    byOrcamento,
    pontuacaoBuckets,
    conversaoPorFonte,
    bySource,
    ttfcRows,
    funnelCounts,
    ttfcRangeRows,
    weeklyFunnel,
  ] = await Promise.all([
    getPipelineCounts(),
    getAvgTimePerStage(),
    getRecentActivity(20),
    getDataQuality(),
    getLeadsByMonth(),
    getLeadsByRenda(),
    getLeadsByOrcamento(),
    getPontuacaoVsEngajamento(),
    getConversaoPorFonte(),
    getTotalLeadsBySource(),
    getTimeToFirstContact(),
    getCommercialFunnelCounts(range),
    getTimeToFirstContact(range),
    getWeeklyFunnel(),
  ]);

  const ttfc = computeFirstContactMetric(ttfcDurationsFromRows(ttfcRows));
  const ttfcRange = computeFirstContactMetric(ttfcDurationsFromRows(ttfcRangeRows));

  const avgByStageId = new Map(avgTimes.map((a) => [a.toStageId, a.avgDurationSeconds]));

  const totalLeads = pipelineCounts.reduce((sum, s) => sum + Number(s.count), 0);
  const openLeads = pipelineCounts.filter((s) => s.stageKind === 'open').reduce((sum, s) => sum + Number(s.count), 0);
  const wonLeads = pipelineCounts.filter((s) => s.stageKind === 'won').reduce((sum, s) => sum + Number(s.count), 0);
  const lostLeads = pipelineCounts.filter((s) => s.stageKind === 'lost').reduce((sum, s) => sum + Number(s.count), 0);

  const concluded = wonLeads + lostLeads;
  const conversionRate = concluded > 0 ? pct(wonLeads, concluded) : null;

  // Leads "não trabalhadas" = ainda em "Aplicação recebida"
  const naoTrabalhadas = pipelineCounts
    .filter((s) => s.stageDisplayName === 'Aplicação recebida')
    .reduce((sum, s) => sum + Number(s.count), 0);

  // Funil para HorizontalBarChart
  const funilData = pipelineCounts.map((row) => ({
    label: row.stageDisplayName ?? '(sem nome)',
    value: Number(row.count),
    color: colorForStageKind(row.stageKind),
  }));

  // Volume mensal: pivot kind por mês
  const monthMap = new Map<string, { open: number; won: number; lost: number }>();
  for (const row of byMonth) {
    const m = row.month;
    if (!monthMap.has(m)) monthMap.set(m, { open: 0, won: 0, lost: 0 });
    const bucket = monthMap.get(m)!;
    if (row.stageKind === 'won') bucket.won += Number(row.count);
    else if (row.stageKind === 'lost') bucket.lost += Number(row.count);
    else bucket.open += Number(row.count);
  }
  const monthData = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => ({
      label: formatMonth(m),
      open: v.open,
      won: v.won,
      lost: v.lost,
    }));

  // Maior mês para caption
  const peakMonth = monthData.reduce(
    (acc, m) => {
      const total = m.open + m.won + m.lost;
      return total > acc.total ? { label: m.label, total, open: m.open } : acc;
    },
    { label: '', total: 0, open: 0 },
  );

  // Renda data — ordenada por valor crescente
  const rendaData = byRenda
    .filter((r) => r.renda !== null)
    .map((r) => ({
      label: r.renda!.length > 40 ? `${r.renda!.slice(0, 38)}…` : r.renda!,
      value: Number(r.count),
      sortKey: extractMinValue(r.renda!),
    }))
    .sort((a, b) => a.sortKey - b.sortKey || a.label.localeCompare(b.label))
    .map(({ label, value }) => ({ label, value }));
  const menosDe8k = rendaData.find((r) => r.label.toLowerCase().includes('menos de r$8'))?.value ?? 0;

  // Orçamento data — números crus (ex: "12") normalizados para "R$12.000", ordenados por valor crescente
  const orcamentoData = byOrcamento
    .filter((o) => o.orcamento !== null)
    .map((o) => {
      const raw = o.orcamento!.trim();
      const label = /^\d+$/.test(raw) ? `R$${raw}.000` : raw;
      const displayLabel = label.length > 40 ? `${label.slice(0, 38)}…` : label;
      return { label: displayLabel, value: Number(o.count), sortKey: extractMinValue(label) };
    })
    .sort((a, b) => a.sortKey - b.sortKey || a.label.localeCompare(b.label))
    .map(({ label, value }) => ({ label, value }));

  // Source data: agregado por nome
  const sourceData = bySource
    .filter((s) => s.count > 0)
    .map((s) => ({
      label: s.sourceName ?? 'Sem fonte',
      value: Number(s.count),
    }))
    .sort((a, b) => b.value - a.value);

  // Top 2 fontes
  const top2SourcePct =
    sourceData.length >= 2
      ? pct(sourceData[0]!.value + sourceData[1]!.value, totalLeads)
      : 0;

  // Pontuação x engajamento
  const pontuacaoData = pontuacaoBuckets
    .filter((b) => b.bucket !== null)
    .map((b) => ({
      label: `${b.bucket} (n=${b.total})`,
      barValue: Math.round((Number(b.engajado) / Number(b.total)) * 100),
      lineValue: Number(b.total),
    }));

  // Conversão por fonte: pivot
  const fonteMap = new Map<string, { open: number; won: number; lost: number; naoTrab: number }>();
  for (const row of conversaoPorFonte) {
    if (!fonteMap.has(row.sourceName)) {
      fonteMap.set(row.sourceName, { open: 0, won: 0, lost: 0, naoTrab: 0 });
    }
    const bucket = fonteMap.get(row.sourceName)!;
    const ct = Number(row.count);
    if (row.stageKind === 'won') bucket.won += ct;
    else if (row.stageKind === 'lost') bucket.lost += ct;
    else if (row.stageSlug === 'application_received') bucket.naoTrab += ct;
    else bucket.open += ct;
  }
  const conversaoData = [...fonteMap.entries()]
    .map(([name, v]) => ({
      label: name,
      engajado: v.open,
      pago: v.won,
      perdido: v.lost,
      naoTrabalhada: v.naoTrab,
      total: v.open + v.won + v.lost + v.naoTrab,
    }))
    .sort((a, b) => b.total - a.total);

  // KPI percents
  const engajadasCount = openLeads - naoTrabalhadas + wonLeads;

  return (
    <div className="flex flex-col">
      <PageHeader title="dashboard." />

      <div className="space-y-10 p-8">
        {/* KPI hero */}
        <div className="grid grid-cols-6 gap-4 [&>*]:min-w-0">
          <KpiCard label="total de leads" value={totalLeads} />
          <KpiCard
            label="engajadas no funil"
            value={engajadasCount}
            note={`${pct(engajadasCount, totalLeads)}% do total`}
          />
          <KpiCard
            label="não trabalhadas"
            value={naoTrabalhadas}
            note={`${pct(naoTrabalhadas, totalLeads)}% aguardando contato`}
            highlight={naoTrabalhadas > 10 ? 'warn' : undefined}
          />
          <KpiCard
            label="pagas"
            value={wonLeads}
            note={`${pct(wonLeads, totalLeads)}% do total`}
            highlight={wonLeads > 0 ? 'win' : undefined}
          />
          <KpiCard
            label="taxa de conversão"
            value={conversionRate !== null ? `${conversionRate}%` : '—'}
            note={concluded > 0 ? `${wonLeads} de ${concluded} concluídos` : 'sem concluídos'}
          />
          <KpiCard
            label="tempo até 1º contato"
            value={ttfc.medianSeconds !== null ? formatDuration(ttfc.medianSeconds) : '—'}
            note={
              ttfc.count > 0
                ? `mediana · ${ttfc.withinSlaPct}% em 24h · base ${ttfc.count}`
                : 'sem dados ainda'
            }
            highlight={
              ttfc.withinSlaPct !== null && ttfc.withinSlaPct < 50 ? 'warn' : undefined
            }
          />
        </div>

        {/* Funil de vendas — logo abaixo do KPI hero (bloco de maior destaque) */}
        <CommercialFunnelSection counts={funnelCounts} range={rangeOption} ttfc={ttfcRange} />

        {/* Evolução semanal — tendência + conversão, sempre 4 semanas (fixo) */}
        <WeeklyFunnelSection weeks={weeklyFunnel} />

        {/* Funil completo */}
        <Section
          title="funil completo por status."
          caption={`Leitura do estado real de cada lead. ${naoTrabalhadas} leads ainda esperando contato inicial.`}
        >
          <HorizontalBarChart data={funilData} yAxisWidth={180} height={320} />
        </Section>

        {/* Volume mensal */}
        {monthData.length > 0 && (
          <Section
            title="volume por mês de entrada."
            caption={
              peakMonth.total > 0
                ? `${peakMonth.label} foi o pico com ${peakMonth.total} leads${
                    peakMonth.open > 0 ? ` — ${peakMonth.open} ainda em aberto.` : '.'
                  }`
                : 'Sem dados temporais ainda.'
            }
          >
            <StackedBarChart
              data={monthData}
              xKey="label"
              series={[
                { dataKey: 'open', label: 'Em aberto', color: CHART_COLORS.open },
                { dataKey: 'won', label: 'Pago', color: CHART_COLORS.won },
                { dataKey: 'lost', label: 'Perdido', color: CHART_COLORS.lost },
              ]}
            />
          </Section>
        )}

        {/* Fontes + Renda */}
        <div className="grid grid-cols-2 gap-8 [&>*]:min-w-0">
          {sourceData.length > 0 && (
            <Section
              title="de onde vêm os leads."
              caption={
                top2SourcePct > 60
                  ? `${top2SourcePct}% concentrado nas top 2 fontes.`
                  : 'Distribuição entre fontes.'
              }
            >
              <DonutChart data={sourceData} height={260} />
            </Section>
          )}

          {rendaData.length > 0 && (
            <Section
              title="renda declarada."
              caption={
                menosDe8k > 0
                  ? `${pct(menosDe8k, quality.comRenda)}% declara menos de R$8k/mês.`
                  : 'Distribuição de renda.'
              }
            >
              <HorizontalBarChart
                data={rendaData}
                defaultColor={CHART_COLORS.inkMuted}
                yAxisWidth={240}
                height={320}
              />
            </Section>
          )}
        </div>

        {/* Orçamento + Pontuação */}
        <div className="grid grid-cols-2 gap-8 [&>*]:min-w-0">
          {orcamentoData.length > 0 && (
            <Section
              title="orçamento declarado."
              caption="Quanto o lead pretende investir nos próximos 12 meses."
            >
              <HorizontalBarChart
                data={orcamentoData}
                defaultColor={CHART_COLORS.open}
                yAxisWidth={240}
                height={320}
              />
            </Section>
          )}

          {pontuacaoData.length > 0 && (
            <Section
              title="pontuação x engajamento."
              caption="Pontuação mais alta não significa maior engajamento."
            >
              <DualAxisChart
                data={pontuacaoData}
                barLabel="% engajado"
                lineLabel="Volume"
                lineSuffix=""
                barColor={CHART_COLORS.won}
                lineColor={CHART_COLORS.ink}
                height={300}
              />
            </Section>
          )}
        </div>

        {/* Conversão por fonte */}
        {conversaoData.length > 0 && (
          <Section
            title="conversão por fonte."
            caption="Como cada fonte performa no pipeline — pagas, perdidas e leads ainda parados."
          >
            <StackedBarChart
              data={conversaoData}
              xKey="label"
              height={280}
              series={[
                { dataKey: 'pago', label: 'Pago', color: CHART_COLORS.won },
                { dataKey: 'engajado', label: 'Engajado', color: CHART_COLORS.open },
                { dataKey: 'naoTrabalhada', label: 'Não trabalhada', color: CHART_COLORS.notWorked },
                { dataKey: 'perdido', label: 'Perdido', color: CHART_COLORS.lost },
              ]}
            />
          </Section>
        )}

        {/* Qualidade + Atividade */}
        <div className="grid grid-cols-2 gap-8 [&>*]:min-w-0">
          <section>
            <h2 className="mb-5 text-h3 text-ink">qualidade dos dados.</h2>
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

          <section>
            <h2 className="mb-5 text-h3 text-ink">atividade recente.</h2>
            {recentActivity.length === 0 ? (
              <Card>
                <p className="text-body text-ink-muted">nenhuma movimentação ainda.</p>
              </Card>
            ) : (
              <Card className="min-w-0 overflow-hidden p-0">
                <div className="max-h-[300px] divide-y divide-line overflow-y-auto">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body text-ink">
                          {item.leadNickname ?? item.leadName}
                        </p>
                        <p className="truncate text-micro text-ink-muted">
                          {item.fromStageName ?? '—'} → {item.toStageName}
                        </p>
                      </div>
                      <p className="shrink-0 text-micro text-ink-muted">
                        {formatDistanceToNow(new Date(item.changedAt), {
                          locale: ptBR,
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </section>
        </div>

        {/* Tempo médio por estágio — referência detalhada */}
        <section>
          <h2 className="mb-5 text-h3 text-ink">tempo médio por estágio.</h2>
          <Card className="p-0">
            <table className="w-full">
              <thead className="border-b border-line">
                <tr>
                  <th className="px-5 py-3 text-left text-micro text-ink-muted">Estágio</th>
                  <th className="px-5 py-3 text-right text-micro text-ink-muted">Leads</th>
                  <th className="px-5 py-3 text-right text-micro text-ink-muted">Tempo médio</th>
                </tr>
              </thead>
              <tbody>
                {pipelineCounts.map((row) => (
                  <tr key={row.stageId} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-body text-ink">{row.stageDisplayName}</td>
                    <td className="px-5 py-3 text-right font-tabular-nums text-body text-ink">
                      {row.count}
                    </td>
                    <td className="px-5 py-3 text-right text-body text-ink-muted">
                      {formatDuration(avgByStageId.get(row.stageId) ?? null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: string | number;
  note?: string;
  highlight?: 'win' | 'warn';
}) {
  const valueColor =
    highlight === 'win' ? 'text-emerald-700' : highlight === 'warn' ? 'text-amber-700' : 'text-ink';
  return (
    <Card className="min-w-0 overflow-hidden">
      <p className="text-micro text-ink-muted">{label}</p>
      <p className={`mt-3 break-words text-h2 ${valueColor}`}>{value}</p>
      {note && <p className="mt-1 text-micro text-ink-muted">{note}</p>}
    </Card>
  );
}

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-h3 text-ink">{title}</h2>
      {caption && <p className="mb-5 mt-1 text-micro text-ink-muted">{caption}</p>}
      {!caption && <div className="mb-5" />}
      <Card className="min-w-0 overflow-hidden">{children}</Card>
    </section>
  );
}
