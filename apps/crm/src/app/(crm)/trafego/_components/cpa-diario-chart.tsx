'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, CHART_TYPOGRAPHY } from '@/components/charts/chart-theme';

const DATA = [
  { data: '18/04', cpa: null },
  { data: '19/04', cpa: null },
  { data: '20/04', cpa: null },
  { data: '21/04', cpa: null },
  { data: '22/04', cpa: null },
  { data: '23/04', cpa: null },
  { data: '24/04', cpa: null },
  { data: '25/04', cpa: 65 },
  { data: '26/04', cpa: 58 },
  { data: '27/04', cpa: 120 },
  { data: '28/04', cpa: null },
  { data: '29/04', cpa: null },
  { data: '30/04', cpa: 32 },
  { data: '01/05', cpa: null },
  { data: '02/05', cpa: null },
  { data: '03/05', cpa: 100 },
  { data: '04/05', cpa: null },
  { data: '05/05', cpa: 38 },
  { data: '06/05', cpa: 30 },
  { data: '07/05', cpa: null },
  { data: '08/05', cpa: null },
  { data: '09/05', cpa: null },
  { data: '10/05', cpa: null },
  { data: '11/05', cpa: null },
  { data: '12/05', cpa: 100 },
  { data: '13/05', cpa: null },
  { data: '14/05', cpa: null },
  { data: '15/05', cpa: 63 },
  { data: '16/05', cpa: 62 },
  { data: '17/05', cpa: null },
  { data: '18/05', cpa: null },
];

const TICKS = ['18/04', '21/04', '24/04', '27/04', '30/04', '03/05', '06/05', '09/05', '12/05', '15/05', '18/05'];

export function CpaDiarioChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={DATA} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.line} vertical={false} />
        <XAxis
          dataKey="data"
          ticks={TICKS}
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
          tickFormatter={(v) => `R$${v}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: CHART_COLORS.paper,
            border: `1px solid ${CHART_COLORS.line}`,
            borderRadius: 4,
            fontSize: 12,
          }}
          formatter={(v) => [`R$${v}`, 'CPA']}
        />
        <Bar dataKey="cpa" name="CPA diário" fill={CHART_COLORS.noReturn} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
