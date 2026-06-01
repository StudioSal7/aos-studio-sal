'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, CHART_TYPOGRAPHY } from './chart-theme';

export type StackedBarSeries = {
  dataKey: string;
  label: string;
  color: string;
};

export function StackedBarChart({
  data,
  series,
  xKey,
  height = 320,
}: {
  data: Array<Record<string, number | string>>;
  series: StackedBarSeries[];
  xKey: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.line} vertical={false} />
        <XAxis
          dataKey={xKey}
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
        />
        <Tooltip
          contentStyle={{
            backgroundColor: CHART_COLORS.paper,
            border: `1px solid ${CHART_COLORS.line}`,
            borderRadius: 4,
            fontSize: 12,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="square"
          iconSize={10}
        />
        {series.map((s) => (
          <Bar key={s.dataKey} dataKey={s.dataKey} name={s.label} stackId="a" fill={s.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
