/**
 * Conversão "fluxo na semana" (throughput): compara o que ENTROU em cada etapa
 * na MESMA semana. Não é coorte — não segue o lead ao longo do tempo.
 * Denominador 0 → `null` (sem base pra taxa; a UI mostra "—" em vez de chutar).
 */

/** Taxa de avanço prev → next em % inteiro. `null` quando não há base (prev ≤ 0). */
export function conversionPct(prev: number, next: number): number | null {
  if (prev <= 0) return null;
  return Math.round((next / prev) * 100);
}

/** Taxas dos pares adjacentes de uma sequência de etapas. Comprimento = n-1. */
export function weeklyConversions(values: number[]): Array<number | null> {
  const out: Array<number | null> = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const next = values[i];
    if (prev === undefined || next === undefined) continue; // inalcançável; satisfaz noUncheckedIndexedAccess
    out.push(conversionPct(prev, next));
  }
  return out;
}
