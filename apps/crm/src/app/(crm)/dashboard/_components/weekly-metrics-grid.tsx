// Grid semanal transposto — linhas = métricas, colunas = as últimas N semanas
// de calendário (segunda→domingo em SP, mais antiga à esquerda; a corrente
// marcada "em curso"). Leitura horizontal = evolução no tempo, como a planilha
// do dono. Independe do filtro de período do topo da página.
//
// Zona 1: volumes crus (número puro + seta discreta de variação vs semana
// anterior). Zona 2: conversões entre etapas (fluxo na semana) pintadas pelo
// semáforo de metas — sem meta cadastrada, célula fica cinza (nunca colorir
// no escuro). Semáforo nunca é só cor: glifo ▲/●/▼ acompanha o valor.

import { Card } from '@/components/ui/card';
import { METRIC_REGISTRY } from '@/server/lib/metric-registry/index';
import {
  evaluateMetric,
  trafficLightGlyph,
  type MetricTargetInput,
  type TrafficLight,
} from '@/server/lib/metric-target-evaluator/index';
import { conversionPct, weekDelta } from '@/server/lib/week-range/conversion';
import type { CommercialFunnelCounts, WeeklyFunnelRow } from '@/server/queries/commercial-funnel';

// Etapas coletadas, na ordem do funil. `key` casa com CommercialFunnelCounts.
const VOLUME_ROWS: Array<{ key: keyof CommercialFunnelCounts; label: string }> = [
  { key: 'leadsEntered', label: 'leads' },
  { key: 'formResponses', label: 'formulários' },
  { key: 'qualifiedReached', label: 'qualificados' },
  { key: 'firstContactReached', label: '1º contato' },
  { key: 'meetingsScheduled', label: 'reunião agendada' },
  { key: 'meetingsAttended', label: 'reunião realizada' },
  { key: 'proposalsSent', label: 'proposta' },
  { key: 'salesWon', label: 'venda' },
];

// Conversões do registry que existem semana a semana (conv_global fica no
// KPI hero do período — repeti-la aqui só duplicaria a última linha).
const RATE_ROWS = METRIC_REGISTRY.filter((m) => m.flow && m.key !== 'conv_global');

const DELTA_GLYPH: Record<'up' | 'down' | 'flat', string> = {
  up: '↑',
  down: '↓',
  flat: '=',
};

const RATE_CELL_CLASSES: Record<TrafficLight, string> = {
  green: 'bg-leaf/15 text-leaf',
  yellow: 'bg-wood/15 text-wood',
  red: 'bg-clay/15 text-clay',
  gray: 'text-ink-muted',
};

const thBase = 'whitespace-nowrap px-4 py-3 text-micro text-ink-muted';
const tdBase = 'whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-body';
const rowLabelBase = 'whitespace-nowrap px-4 py-2.5 text-left text-[12px] normal-case tracking-normal';

function ZoneHeaderRow({ label, columns }: { label: string; columns: number }) {
  return (
    <tr className="border-b border-line bg-canvas/60">
      <td colSpan={columns + 1} className="px-4 py-2 text-micro text-ink-muted">
        {label}
      </td>
    </tr>
  );
}

export function WeeklyMetricsGrid({
  weeks,
  targets,
}: {
  weeks: WeeklyFunnelRow[];
  targets: Map<string, MetricTargetInput>;
}) {
  // getWeeklyFunnel devolve a mais recente primeiro; a planilha lê da mais
  // antiga (esquerda) para a corrente (direita).
  const ordered = [...weeks].reverse();

  return (
    <section>
      <div className="border-b border-line pb-4">
        <h2 className="text-h3 text-ink">evolução semanal.</h2>
        <p className="mt-1 text-micro text-ink-muted">
          últimas {ordered.length} semanas (segunda a domingo) · independente do filtro de período
          acima · ▲ bate a meta · ● dentro da margem · ▼ abaixo · sem meta = cinza
        </p>
      </div>

      <Card className="mt-6 min-w-0 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-line">
              <tr>
                <th className={`${thBase} text-left`}>métrica</th>
                {ordered.map((w) => (
                  <th key={w.label} className={`${thBase} text-right`}>
                    {w.label}
                    {w.isCurrent && (
                      <span className="ml-1.5 font-medium text-wood">em curso</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <ZoneHeaderRow label="volume por etapa" columns={ordered.length} />
              {VOLUME_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-line last:border-0">
                  <td className={`${rowLabelBase} text-ink`}>{row.label}</td>
                  {ordered.map((w, i) => {
                    const value = w.counts[row.key];
                    const delta = weekDelta(ordered[i - 1]?.counts[row.key], value);
                    return (
                      <td key={w.label} className={tdBase}>
                        {delta !== null && (
                          <span className="mr-1 text-[10px] text-ink-muted">
                            {DELTA_GLYPH[delta]}
                          </span>
                        )}
                        <span className={value === 0 ? 'text-ink-muted' : 'text-ink'}>{value}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}

              <ZoneHeaderRow
                label="conversão entre etapas (fluxo na semana — etapa seguinte ÷ etapa anterior da mesma semana)"
                columns={ordered.length}
              />
              {RATE_ROWS.map((metric) => {
                const target = targets.get(metric.key) ?? null;
                return (
                  <tr key={metric.key} className="border-b border-line last:border-0">
                    <td className={`${rowLabelBase} text-ink`}>{metric.label}</td>
                    {ordered.map((w) => {
                      const { numerator, denominator } = metric.flow!;
                      const value = conversionPct(w.counts[denominator], w.counts[numerator]);
                      if (value === null) {
                        return (
                          <td key={w.label} className={`${tdBase} text-ink-muted`}>
                            —
                          </td>
                        );
                      }
                      const status = evaluateMetric(value, target);
                      const glyph = trafficLightGlyph(status);
                      return (
                        <td key={w.label} className={`${tdBase} ${RATE_CELL_CLASSES[status]}`}>
                          {glyph && <span className="mr-1 text-[10px]">{glyph}</span>}
                          {value}%
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
