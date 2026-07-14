import { redirect } from 'next/navigation';
import { toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { requireAuth } from '@/server/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PeriodFilter } from '@/components/ui/period-filter';
import { CHART_COLORS } from '@/components/charts/chart-theme';
import { HorizontalBarChart } from '@/components/charts/horizontal-bar-chart';
import { StackedBarChart } from '@/components/charts/stacked-bar-chart';
import { DonutChart } from '@/components/charts/donut-chart';
import {
  getDataQuality,
  getRecentSales,
  getSalesByCampaign,
  getSalesByCreative,
  getSalesByPeriod,
  getSalesByPlacement,
  getSalesByTrafficType,
  getSalesKpis,
  type SalesRange,
} from '@/server/queries/sal-sales';

const RANGE_OPTIONS: Array<{ value: SalesRange; label: string }> = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'tudo' },
];

const TRAFFIC_LABEL: Record<string, string> = {
  paid: 'tráfego pago',
  organic: 'orgânico',
  unknown: 'sem fonte',
};

const MONTH_LABELS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

const fmtBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const fmtBRLcompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

function toCents(n: number | string | null | undefined): number {
  if (n == null) return 0;
  return typeof n === 'string' ? Number(n) : n;
}

function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function formatBucket(bucket: string, range: SalesRange): string {
  const [y, m, d] = bucket.split('-');
  if (range === 'all') {
    const monthIdx = Number(m) - 1;
    return `${MONTH_LABELS[monthIdx] ?? ''}/${y!.slice(-2)}`;
  }
  return `${d}/${m}`;
}

function shortLabel(s: string, max = 40): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function shortCampaign(c: string): string {
  if (!c || c === '(sem campanha)') return '(sem campanha)';
  if (c.toLowerCase() === 'organico') return 'orgânico';
  if (/^\d{15,}$/.test(c)) return `meta · …${c.slice(-6)}`;
  return shortLabel(c, 24);
}

function isValidRange(v: string | undefined): v is SalesRange {
  return v === '7d' || v === '30d' || v === '90d' || v === 'all';
}

export default async function VendasSalPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const params = await searchParams;
  const range: SalesRange = isValidRange(params.range) ? params.range : '30d';

  const [
    kpis,
    byPeriod,
    byTraffic,
    byCampaign,
    byCreative,
    byPlacement,
    recent,
    quality,
  ] = await Promise.all([
    getSalesKpis(range),
    getSalesByPeriod(range),
    getSalesByTrafficType(range),
    getSalesByCampaign(range, 10),
    getSalesByCreative(range),
    getSalesByPlacement(range),
    getRecentSales(range, 20),
    getDataQuality(range),
  ]);

  const revenueReais = toCents(kpis.revenueCents) / 100;
  const avgTicketReais = kpis.approvedCount > 0 ? revenueReais / kpis.approvedCount : 0;
  const paidShare = pct(kpis.paidCount, kpis.approvedCount);

  // Série temporal — pivot por trafficType
  const periodMap = new Map<string, { paid: number; organic: number; unknown: number }>();
  for (const row of byPeriod) {
    if (!periodMap.has(row.bucket)) {
      periodMap.set(row.bucket, { paid: 0, organic: 0, unknown: 0 });
    }
    const bucket = periodMap.get(row.bucket)!;
    const ct = Number(row.count);
    if (row.trafficType === 'paid') bucket.paid = ct;
    else if (row.trafficType === 'organic') bucket.organic = ct;
    else bucket.unknown = ct;
  }
  const periodData = [...periodMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, v]) => ({ label: formatBucket(bucket, range), ...v }));

  // Mix de tráfego (donut)
  const trafficData = byTraffic.map((r) => ({
    label: TRAFFIC_LABEL[r.trafficType] ?? r.trafficType,
    value: Number(r.count),
  }));

  // Top campanhas (horizontal bar) — value = count, label inclui receita
  const campaignData = byCampaign
    .filter((r) => Number(r.count) > 0)
    .map((r) => ({
      label: `${shortCampaign(r.campaign)} · ${fmtBRLcompact.format(toCents(r.revenueCents) / 100)}`,
      value: Number(r.count),
      color: r.campaign.toLowerCase() === 'organico' ? CHART_COLORS.won : CHART_COLORS.open,
    }));

  // Criativos (top 12 por receita) — featured chart
  const creativeData = byCreative
    .slice(0, 12)
    .map((r) => ({
      label: `${shortLabel(r.term, 38)} · ${fmtBRLcompact.format(toCents(r.revenueCents) / 100)}`,
      value: Number(r.count),
    }));

  // Placement (donut)
  const placementData = byPlacement.map((r) => ({
    label: r.placement,
    value: Number(r.count),
  }));

  // Qualidade dos dados (% de preenchimento em aprovadas)
  const qualityRows = [
    { label: 'Telefone preenchido', value: Number(quality.withPhone) },
    { label: 'Telefone normalizado (E.164)', value: Number(quality.withE164) },
    { label: 'UTM Source', value: Number(quality.withUtmSource) },
    { label: 'UTM Campaign', value: Number(quality.withCampaign) },
    { label: 'UTM Term', value: Number(quality.withTerm) },
  ];
  const qualityTotal = Number(quality.total);

  const hasData = kpis.totalCount > 0;

  return (
    <div className="flex flex-col">
      <PageHeader title="vendas sal.">
        <PeriodFilter current={range} options={RANGE_OPTIONS} />
      </PageHeader>

      <div className="space-y-10 p-8">
        {!hasData ? (
          <Card>
            <p className="text-body text-ink">
              nenhuma venda no período selecionado.
            </p>
            <p className="mt-2 text-micro text-ink-muted normal-case tracking-normal">
              importe um novo CSV com{' '}
              <code className="font-mono">pnpm --filter crm import-sal-sales -- ./caminho/arquivo.csv</code>
            </p>
          </Card>
        ) : (
          <>
            {/* KPI hero */}
            <div className="grid grid-cols-5 gap-4">
              <KpiCard label="vendas aprovadas" value={kpis.approvedCount} />
              <KpiCard
                label="receita aprovada"
                value={fmtBRL.format(revenueReais)}
                highlight="win"
              />
              <KpiCard
                label="ticket médio"
                value={fmtBRL.format(avgTicketReais)}
              />
              <KpiCard
                label="vendas via tráfego pago"
                value={kpis.paidCount}
                note={`${paidShare}% das aprovadas`}
              />
              <KpiCard
                label="testes / cancelados"
                value={kpis.testCount + kpis.refundedCount}
                note={
                  kpis.refundedCount > 0
                    ? `${kpis.testCount} testes · ${kpis.refundedCount} reembolsos`
                    : `${kpis.testCount} testes (não contabilizados na receita)`
                }
              />
            </div>

            {/* Série temporal */}
            <Section
              title="vendas aprovadas ao longo do tempo."
              caption={
                range === 'all'
                  ? 'Agrupado por mês.'
                  : range === '90d'
                  ? 'Agrupado por semana.'
                  : 'Agrupado por dia (horário SP).'
              }
            >
              {periodData.length > 0 ? (
                <StackedBarChart
                  data={periodData}
                  xKey="label"
                  series={[
                    { dataKey: 'paid', label: 'tráfego pago', color: CHART_COLORS.open },
                    { dataKey: 'organic', label: 'orgânico', color: CHART_COLORS.won },
                    { dataKey: 'unknown', label: 'sem fonte', color: CHART_COLORS.notWorked },
                  ]}
                />
              ) : (
                <EmptyChart />
              )}
            </Section>

            {/* Mix tráfego + Top campanhas */}
            <div className="grid grid-cols-2 gap-8">
              <Section
                title="mix de tráfego."
                caption={`${kpis.paidCount} pago · ${kpis.organicCount} orgânico · ${kpis.unknownCount} sem fonte`}
              >
                {trafficData.length > 0 ? (
                  <DonutChart
                    data={trafficData}
                    height={260}
                    colors={[CHART_COLORS.open, CHART_COLORS.won, CHART_COLORS.notWorked]}
                  />
                ) : (
                  <EmptyChart />
                )}
              </Section>

              <Section
                title="top campanhas."
                caption="Vendas e receita por UTM Campaign — top 10."
              >
                {campaignData.length > 0 ? (
                  <HorizontalBarChart
                    data={campaignData}
                    yAxisWidth={220}
                    height={320}
                  />
                ) : (
                  <EmptyChart />
                )}
              </Section>
            </div>

            {/* Criativos — featured */}
            <Section
              title="performance por criativo."
              caption="Vendas e receita por UTM Term (vídeo/AD). O criativo no topo é o que mais paga o tráfego."
            >
              {creativeData.length > 0 ? (
                <HorizontalBarChart
                  data={creativeData}
                  yAxisWidth={320}
                  height={Math.max(220, creativeData.length * 36)}
                  defaultColor={CHART_COLORS.ink}
                />
              ) : (
                <EmptyChart />
              )}
            </Section>

            {/* Placement + Qualidade */}
            <div className="grid grid-cols-2 gap-8">
              <Section
                title="placement (Instagram)."
                caption="Extraído da UTM Content — onde o anúncio rodou."
              >
                {placementData.length > 0 ? (
                  <DonutChart data={placementData} height={260} />
                ) : (
                  <EmptyChart />
                )}
              </Section>

              <section>
                <h2 className="text-h3 text-ink">qualidade dos dados.</h2>
                <p className="mb-5 mt-1 text-micro text-ink-muted">
                  Em {qualityTotal} venda{qualityTotal === 1 ? '' : 's'} aprovada{qualityTotal === 1 ? '' : 's'} no período.
                </p>
                <Card className="space-y-4">
                  {qualityRows.map(({ label, value }) => {
                    const p = pct(value, qualityTotal);
                    return (
                      <div key={label} className="space-y-1.5">
                        <div className="flex justify-between text-micro">
                          <span className="text-ink">{label}</span>
                          <span className="text-ink-muted">
                            {value} / {qualityTotal} ({p}%)
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

            {/* Vendas recentes */}
            <section>
              <h2 className="mb-5 text-h3 text-ink">vendas recentes.</h2>
              <Card className="p-0">
                <table className="w-full">
                  <thead className="border-b border-line">
                    <tr>
                      <th className="px-5 py-3 text-left text-micro text-ink-muted">Data</th>
                      <th className="px-5 py-3 text-left text-micro text-ink-muted">Comprador</th>
                      <th className="px-5 py-3 text-left text-micro text-ink-muted">Status</th>
                      <th className="px-5 py-3 text-left text-micro text-ink-muted">Fonte</th>
                      <th className="px-5 py-3 text-left text-micro text-ink-muted">Criativo</th>
                      <th className="px-5 py-3 text-right text-micro text-ink-muted">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((sale) => {
                      const spDate = toZonedTime(sale.purchasedAt, 'America/Sao_Paulo');
                      return (
                        <tr key={sale.id} className="border-b border-line last:border-0">
                          <td className="px-5 py-3 text-micro text-ink-muted whitespace-nowrap normal-case tracking-normal">
                            {format(spDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </td>
                          <td className="px-5 py-3 text-body text-ink">
                            <div>{sale.buyerName}</div>
                            <div className="text-micro text-ink-muted normal-case tracking-normal">
                              {sale.buyerEmail}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={sale.status} />
                          </td>
                          <td className="px-5 py-3 text-micro text-ink-muted normal-case tracking-normal">
                            {TRAFFIC_LABEL[sale.trafficType] ?? sale.trafficType}
                            {sale.utmSource && (
                              <div className="text-[10px] text-ink-muted/70">{sale.utmSource}</div>
                            )}
                          </td>
                          <td className="px-5 py-3 text-micro text-ink-muted normal-case tracking-normal">
                            {sale.utmTerm ? shortLabel(sale.utmTerm, 36) : '—'}
                          </td>
                          <td className="px-5 py-3 text-right font-tabular-nums text-body text-ink whitespace-nowrap">
                            {fmtBRL.format(toCents(sale.commissionCents) / 100)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </section>
          </>
        )}
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
    highlight === 'win'
      ? 'text-emerald-700'
      : highlight === 'warn'
      ? 'text-amber-700'
      : 'text-ink';
  return (
    <Card className="min-w-0 overflow-hidden">
      <p className="text-micro text-ink-muted">{label}</p>
      <p className={`mt-3 normal-case text-h3 ${valueColor}`}>{value}</p>
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
      <Card>{children}</Card>
    </section>
  );
}

function EmptyChart() {
  return (
    <p className="py-12 text-center text-micro text-ink-muted normal-case tracking-normal">
      sem dados para o período.
    </p>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; cls: string }> = {
    approved: { label: 'aprovada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    test: { label: 'teste', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    refunded: { label: 'reembolso', cls: 'bg-red-50 text-red-700 border-red-200' },
    cancelled: { label: 'cancelada', cls: 'bg-stone-100 text-stone-700 border-stone-300' },
    other: { label: status, cls: 'bg-stone-50 text-stone-600 border-stone-200' },
  };
  const v = variants[status] ?? variants.other!;
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] normal-case tracking-normal ${v.cls}`}
    >
      {v.label}
    </span>
  );
}
