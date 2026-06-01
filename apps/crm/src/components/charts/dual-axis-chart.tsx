'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, CHART_TYPOGRAPHY } from './chart-theme';

export type DualAxisDatum = {
  label: string;
  barValue: number;
  lineValue: number;
};

export function DualAxisChart({
  data,
  barLabel,
  lineLabel,
  barColor = CHART_COLORS.open,
  lineColor = CHART_COLORS.won,
  lineSuffix = '%',
  height = 320,
}: {
  data: DualAxisDatum[];
  barLabel: string;
  lineLabel: string;
  barColor?: string;
  lineColor?: string;
  lineSuffix?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.line} vertical={false} />
        <XAxis
          dataKey="label"
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
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke={CHART_COLORS.inkMuted}
          tick={CHART_TYPOGRAPHY}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}${lineSuffix}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: CHART_COLORS.paper,
            border: `1px solid ${CHART_COLORS.line}`,
            borderRadius: 4,
            fontSize: 12,
          }}
          formatter={(value, name) =>
            name === lineLabel
              ? [`${value}${lineSuffix}`, String(name)]
              : [String(value), String(name)]
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="square"
          iconSize={10}
        />
        <Bar yAxisId="left" dataKey="barValue" name={barLabel} fill={barColor} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="lineValue"
          name={lineLabel}
          stroke={lineColor}
          strokeWidth={2}
          dot={{ fill: lineColor, r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
