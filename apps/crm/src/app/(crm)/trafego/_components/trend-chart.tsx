'use client';

// Vista Tendência: série 7d móvel de CPA / hook / frequência(proxy) por
// criativo, com os eventos manuais da conta anotados como linhas verticais —
// curva quebrada sem evento anotado é ininterpretável.

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, CHART_TYPOGRAPHY } from '@/components/charts/chart-theme';
import type { TrendSeries } from '@/server/lib/ads-report/index';

export interface TrendEvent {
  id: string;
  eventDate: string;
  eventType: string;
  note: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  budget: 'orçamento',
  pause: 'pausa',
  resume: 'retomada',
  creative_edit: 'edição de criativo',
  launch: 'lançamento',
  other: 'outro',
};

function shortDay(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

type ChartDatum = Record<string, string | number | null>;

function buildData(
  series: TrendSeries[],
  pick: (point: TrendSeries['points'][number]) => number | null,
): ChartDatum[] {
  // Chave por adId, NUNCA por adName: a Meta permite duplicar um anúncio em
  // outro adset mantendo o MESMO nome (o próprio playbook "escalar" recomendado
  // aqui) — duas séries com o mesmo nome sobrescreveriam uma à outra no datum.
  const ends = series[0]?.points.map((p) => p.end) ?? [];
  return ends.map((end, i) => {
    const datum: ChartDatum = { end };
    for (const s of series) {
      const point = s.points[i];
      datum[s.adId] = point ? pick(point) : null;
    }
    return datum;
  });
}

function MetricChart({
  title,
  data,
  series,
  events,
  valueFormatter,
}: {
  title: string;
  data: ChartDatum[];
  series: TrendSeries[];
  events: TrendEvent[];
  valueFormatter: (v: number) => string;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-micro text-ink-muted">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.line} vertical={false} />
          <XAxis
            dataKey="end"
            tickFormatter={shortDay}
            tick={{ ...CHART_TYPOGRAPHY, fill: CHART_COLORS.inkMuted }}
            axisLine={{ stroke: CHART_COLORS.line }}
            tickLine={false}
          />
          <YAxis
            width={52}
            tickFormatter={(v: number) => valueFormatter(v)}
            tick={{ ...CHART_TYPOGRAPHY, fill: CHART_COLORS.inkMuted }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            labelFormatter={(label) => `janela 7d até ${shortDay(String(label))}`}
            formatter={(value) => (typeof value === 'number' ? valueFormatter(value) : '—')}
            contentStyle={{
              border: `1px solid ${CHART_COLORS.line}`,
              background: CHART_COLORS.paper,
              fontSize: CHART_TYPOGRAPHY.fontSize,
            }}
          />
          <Legend wrapperStyle={{ fontSize: CHART_TYPOGRAPHY.fontSize }} />
          {events.map((ev) => (
            <ReferenceLine
              key={`${ev.id}`}
              x={ev.eventDate}
              stroke={CHART_COLORS.noReturn}
              strokeDasharray="4 3"
              label={{
                value: EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType,
                position: 'top',
                fontSize: 10,
                fill: CHART_COLORS.noReturn,
              }}
            />
          ))}
          {series.map((s, i) => (
            <Line
              key={s.adId}
              type="monotone"
              dataKey={s.adId}
              name={s.adName}
              stroke={CHART_COLORS.series[i % CHART_COLORS.series.length]}
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendCharts({ series, events }: { series: TrendSeries[]; events: TrendEvent[] }) {
  if (series.length === 0) {
    return (
      <p className="text-body text-ink-muted">
        nenhum criativo com gasto neste segmento na janela de tendência.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <MetricChart
        title="cpa · janela 7d móvel"
        data={buildData(series, (p) => (p.cpaCents === null ? null : p.cpaCents / 100))}
        series={series}
        events={events}
        valueFormatter={(v) => `R$${v.toFixed(0)}`}
      />
      <MetricChart
        title="hook rate · janela 7d móvel"
        data={buildData(series, (p) => (p.hookRate === null ? null : p.hookRate * 100))}
        series={series}
        events={events}
        valueFormatter={(v) => `${v.toFixed(1)}%`}
      />
      <MetricChart
        title="frequência (proxy: impressões ÷ Σalcance diário) · janela 7d móvel"
        data={buildData(series, (p) => p.frequencyProxy)}
        series={series}
        events={events}
        valueFormatter={(v) => v.toFixed(2)}
      />
    </div>
  );
}
