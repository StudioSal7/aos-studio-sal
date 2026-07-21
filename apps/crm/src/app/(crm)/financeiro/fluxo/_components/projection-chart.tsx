'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, CHART_TYPOGRAPHY } from '@/components/charts/chart-theme';

// Cada ponto já vem em reais (não centavos) pra os eixos ficarem legíveis.
export type ProjectionChartDatum = {
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
};

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export function ProjectionChart({ data }: { data: ProjectionChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.line} vertical={false} />
        <XAxis
          dataKey="label"
          stroke={CHART_COLORS.inkMuted}
          tick={CHART_TYPOGRAPHY}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.line }}
        />
        <YAxis
          stroke={CHART_COLORS.inkMuted}
          tick={CHART_TYPOGRAPHY}
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v) => BRL.format(Number(v))}
        />
        <ReferenceLine y={0} stroke={CHART_COLORS.lost} strokeDasharray="4 2" />
        <Tooltip
          contentStyle={{
            backgroundColor: CHART_COLORS.paper,
            border: `1px solid ${CHART_COLORS.line}`,
            borderRadius: 4,
            fontSize: 12,
          }}
          formatter={(value, name) => [BRL.format(Number(value)), String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" iconSize={10} />
        <Bar dataKey="entradas" name="entradas previstas" fill={CHART_COLORS.won} radius={[2, 2, 0, 0]} />
        <Bar dataKey="saidas" name="saídas previstas" fill={CHART_COLORS.noReturn} radius={[2, 2, 0, 0]} />
        <Line
          type="monotone"
          dataKey="saldo"
          name="saldo projetado"
          stroke={CHART_COLORS.ink}
          strokeWidth={2}
          dot={{ fill: CHART_COLORS.ink, r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
