'use client';

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, CHART_TYPOGRAPHY } from './chart-theme';

export type HorizontalBarDatum = {
  label: string;
  value: number;
  color?: string;
};

export function HorizontalBarChart({
  data,
  height = 360,
  defaultColor = CHART_COLORS.ink,
  yAxisWidth = 180,
}: {
  data: HorizontalBarDatum[];
  height?: number;
  defaultColor?: string;
  yAxisWidth?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
      >
        <XAxis
          type="number"
          stroke={CHART_COLORS.inkMuted}
          tick={CHART_TYPOGRAPHY}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.line }}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={yAxisWidth}
          stroke={CHART_COLORS.inkMuted}
          tick={CHART_TYPOGRAPHY}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: CHART_COLORS.canvas }}
          contentStyle={{
            backgroundColor: CHART_COLORS.paper,
            border: `1px solid ${CHART_COLORS.line}`,
            borderRadius: 4,
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" radius={[0, 2, 2, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? defaultColor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
