/**
 * Semáforo por meta — módulo puro (sem DB). Compara um valor medido contra a
 * meta cadastrada em `metric_targets` e devolve o status do sinal.
 *
 * value null/NaN → 'gray' (sem base amostral). target null → 'gray' (métrica
 * sem meta cadastrada — nunca colorir no escuro).
 *
 * gte: value >= threshold              → green
 *      value >= threshold - yellowMargin → yellow
 *      senão                             → red
 * lte: value <= threshold              → green
 *      value <= threshold + yellowMargin → yellow
 *      senão                             → red
 *
 * O limite é sempre inclusivo pro lado bom (value === threshold é green).
 * yellowMargin negativo é tratado como 0 (defensivo — o CHECK do banco já
 * impede isso na origem). yellowMargin = 0 dá faixa amarela vazia (semáforo
 * binário verde/vermelho).
 */

export type TrafficLight = 'green' | 'yellow' | 'red' | 'gray';

export interface MetricTargetInput {
  comparator: 'gte' | 'lte';
  threshold: number;
  yellowMargin: number;
}

export function evaluateMetric(
  value: number | null,
  target: MetricTargetInput | null,
): TrafficLight {
  if (value === null || !Number.isFinite(value)) return 'gray';
  if (target === null) return 'gray';

  const margin = Math.max(0, target.yellowMargin);

  if (target.comparator === 'gte') {
    if (value >= target.threshold) return 'green';
    if (value >= target.threshold - margin) return 'yellow';
    return 'red';
  }

  // lte
  if (value <= target.threshold) return 'green';
  if (value <= target.threshold + margin) return 'yellow';
  return 'red';
}

export function trafficLightGlyph(status: TrafficLight): '▲' | '●' | '▼' | '' {
  if (status === 'green') return '▲';
  if (status === 'yellow') return '●';
  if (status === 'red') return '▼';
  return '';
}
