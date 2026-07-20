import { requireAuth } from '@/server/auth';
import { PageHeader } from '@/components/ui/page-header';
import { PeriodFilter } from '@/components/ui/period-filter';
import { adsConfig } from '@/lib/ads.config';
import { buildTrafegoReport } from '@/server/lib/ads-report/index';
import { dayInSaoPaulo, reportDataWindow } from '@/server/lib/ads-windows/index';
import { getAccountEvents, getInsightsRange, getLastSyncRun } from '@/server/queries/trafego';
import { DecisionTable } from './_components/decision-table';
import { EventsPanel } from './_components/events-panel';
import { KpiCard } from './_components/kpi-card';
import { RetentionCurves } from './_components/retention-curve';
import { SyncStatus } from './_components/sync-status';
import { TrendCharts } from './_components/trend-chart';
import { VistaTabs } from './_components/vista-tabs';
import { isVistaKey, type VistaKey } from './_components/vistas';
import { brl, pct, roasX, shortDay } from './_components/format';

export const dynamic = 'force-dynamic';

const SEGMENT_LABELS: Record<string, string> = {
  frio: 'frio',
  quente: 'quente',
  nao_classificado: 'não classificado',
};

export default async function TrafegoPagoPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; segmento?: string }>;
}) {
  const auth = await requireAuth();
  const params = await searchParams;

  const now = new Date();
  const dataWindow = reportDataWindow(now, adsConfig.rules);

  // Exatamente 3 queries por load (pool max:10) — derivação toda no código.
  const [insights, events, lastRun] = await Promise.all([
    getInsightsRange(dataWindow.since, dataWindow.until),
    getAccountEvents(dataWindow.since),
    getLastSyncRun(),
  ]);

  const report = buildTrafegoReport(insights, adsConfig, now);

  // Seletor de segmento OBRIGATÓRIO — default frio, nunca blended.
  const segmento =
    params.segmento && report.segments.includes(params.segmento)
      ? params.segmento
      : (adsConfig.segments[0]?.key ?? 'frio');
  const vista: VistaKey = isVistaKey(params.vista) ? params.vista : 'decisao';

  const segmentKpis = report.kpis.bySegment[segmento];
  const total = report.kpis.blendedTotal;
  const decisionRows = report.decisionRows[segmento] ?? [];
  const curves = report.curves[segmento] ?? [];
  // Tendência legível: top 6 criativos por gasto na janela de tendência.
  const trendSeries = (report.trends[segmento] ?? [])
    .slice()
    .sort(
      (a, b) =>
        b.points.reduce((s, p) => s + p.spendCents, 0) -
        a.points.reduce((s, p) => s + p.spendCents, 0),
    )
    .slice(0, 6);

  const trendEvents = events
    .filter((ev) => ev.eventDate >= report.trendRange.since)
    .map((ev) => ({ id: ev.id, eventDate: ev.eventDate, eventType: ev.eventType, note: ev.note }));

  return (
    <div className="flex flex-col">
      <PageHeader title="tráfego pago.">
        <PeriodFilter
          current={segmento}
          paramName="segmento"
          options={report.segments.map((s) => ({ value: s, label: SEGMENT_LABELS[s] ?? s }))}
        />
      </PageHeader>

      <div className="space-y-8 p-8">
        <SyncStatus lastRun={lastRun} hasRowsInWindow={total.totals.days > 0} />

        {report.unclassifiedCampaigns.length > 0 && (
          <div className="border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-[12px] normal-case tracking-normal text-red-800">
              {report.unclassifiedCampaigns.length} campanha(s) fora da convenção de nome (sem
              segmento frio/quente): {report.unclassifiedCampaigns.join(' · ')} — ajustar o nome na
              Meta ou os padrões em <code>ads.config.ts</code>.
            </p>
          </div>
        )}

        {/* KPIs do segmento selecionado — diagnóstico, separado do veredito */}
        <section>
          <h2 className="mb-1 text-h3 text-ink">
            segmento {SEGMENT_LABELS[segmento] ?? segmento}.
          </h2>
          <p className="mb-5 text-micro normal-case tracking-normal text-ink-muted">
            janela de decisão {shortDay(report.window.since)}–{shortDay(report.window.until)} (7d
            fechada em D-{adsConfig.rules.attributionSettleDays}, atribuição assentada)
          </p>
          <div className="grid grid-cols-5 gap-4 [&>*]:min-w-0">
            <KpiCard label="investimento" value={brl(segmentKpis?.totals.spendCents ?? 0)} />
            <KpiCard label="vendas" value={segmentKpis?.totals.purchases ?? 0} />
            <KpiCard label="cpa" value={brl(segmentKpis?.cpaCents ?? null)} />
            <KpiCard label="roas" value={roasX(segmentKpis?.roas ?? null)} />
            <KpiCard label="receita" value={brl(segmentKpis?.totals.purchaseValueCents ?? 0)} />
          </div>
          <p className="mt-3 text-micro normal-case tracking-normal text-ink-muted">
            conta inteira (blended): {brl(total.totals.spendCents)} investidos ·{' '}
            {total.totals.purchases} vendas · cpa {brl(total.cpaCents)} · roas {roasX(total.roas)} ·
            hook {pct(total.hookRate)}
          </p>
        </section>

        <VistaTabs active={vista} />

        {vista === 'decisao' && (
          <DecisionTable
            rows={decisionRows}
            window={report.window}
            holdLabel={`hold ${adsConfig.video.holdVariant.replace('p', '')}`}
          />
        )}

        {vista === 'curva' && <RetentionCurves curves={curves} />}

        {vista === 'tendencia' && (
          <div className="space-y-8">
            <TrendCharts series={trendSeries} events={trendEvents} />
            <section>
              <h2 className="mb-1 text-h3 text-ink">log de mudanças.</h2>
              <p className="mb-4 text-micro normal-case tracking-normal text-ink-muted">
                anote toda mudança na conta (orçamento, pausa, criativo) — sem isso, curva quebrada
                é ininterpretável.
              </p>
              <EventsPanel
                events={events.map((ev) => ({
                  id: ev.id,
                  eventDate: ev.eventDate,
                  level: ev.level,
                  entityId: ev.entityId,
                  eventType: ev.eventType,
                  note: ev.note,
                  createdBy: ev.createdBy,
                }))}
                defaultDate={dayInSaoPaulo(now)}
                isOwner={auth.role === 'owner'}
              />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
