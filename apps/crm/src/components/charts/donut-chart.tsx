'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_COLORS } from './chart-theme';

export type DonutDatum = {
  label: string;
  value: number;
};

export function DonutChart({
  data,
  height = 280,
  colors = CHART_COLORS.series,
}: {
  data: DonutDatum[];
  height?: number;
  colors?: readonly string[];
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex items-center gap-6">
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={60}
              outerRadius={110}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_COLORS.paper,
                border: `1px solid ${CHART_COLORS.line}`,
                borderRadius: 4,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-3">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.label} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <span className="flex-1 text-[12px] leading-snug text-ink normal-case tracking-normal">
                {d.label}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
                {d.value} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
