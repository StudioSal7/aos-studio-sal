'use client';

import {
  Bar,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, CHART_TYPOGRAPHY } from '@/components/charts/chart-theme';

const DATA = [
  { campanha: '[202601] [ONGO...', investimento: 1464, vendas: 5 },
  { campanha: '[202602] [ONGO...', investimento: 1225, vendas: 7 },
];

export function CampanhaChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={DATA} margin={{ top: 8, right: 40, left: -8, bottom: 8 }}>
        <XAxis
          dataKey="campanha"
          stroke={CHART_COLORS.inkMuted}
          tick={CHART_TYPOGRAPHY}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.line }}
        />
        <YAxis
          yAxisId="left"
          stroke={CHART_COLORS.inkMuted}
          tick={CHART_TYPOGRAPHY}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `R$${v}`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke={CHART_COLORS.inkMuted}
          tick={CHART_TYPOGRAPHY}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: CHART_COLORS.paper,
            border: `1px solid ${CHART_COLORS.line}`,
            borderRadius: 4,
            fontSize: 12,
          }}
          formatter={(value, name) =>
            name === 'Investimento'
              ? [`R$${value}`, String(name)]
              : [String(value), String(name)]
          }
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" iconSize={10} />
        <Bar yAxisId="left" dataKey="investimento" name="Investimento" fill={CHART_COLORS.open} />
        <Bar yAxisId="right" dataKey="vendas" name="Vendas" fill={CHART_COLORS.noReturn} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
