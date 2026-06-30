/**
 * Estatística do "tempo até o primeiro contato" para o dashboard.
 *
 * Módulo puro (sem DB). Recebe durações em segundos (1 por lead que já teve
 * primeiro contato) e devolve mediana + % dentro do SLA. Mediana porque a
 * distribuição de tempo de resposta é torta — um lead esquecido distorce a
 * média, não a mediana.
 */

export interface FirstContactMetric {
  /** Quantos leads entraram no cálculo (base amostral). */
  count: number;
  /** Mediana em segundos, ou null se base vazia. */
  medianSeconds: number | null;
  /** % de leads contatados dentro do SLA (inteiro 0–100), ou null se base vazia. */
  withinSlaPct: number | null;
}

const DEFAULT_SLA_HOURS = 24;

export function computeFirstContactMetric(
  durationsSeconds: number[],
  slaHours: number = DEFAULT_SLA_HOURS,
): FirstContactMetric {
  const valid = durationsSeconds
    .filter((d) => Number.isFinite(d) && d >= 0)
    .sort((a, b) => a - b);

  const count = valid.length;
  if (count === 0) return { count: 0, medianSeconds: null, withinSlaPct: null };

  const mid = Math.floor(count / 2);
  const medianSeconds =
    count % 2 === 0 ? (valid[mid - 1] + valid[mid]) / 2 : valid[mid];

  const slaSeconds = slaHours * 3600;
  const withinSla = valid.filter((d) => d <= slaSeconds).length;
  const withinSlaPct = Math.round((withinSla / count) * 100);

  return { count, medianSeconds, withinSlaPct };
}
