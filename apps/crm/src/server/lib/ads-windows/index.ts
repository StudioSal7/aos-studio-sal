/**
 * ads-windows — janelas de dias (grão diário) do pipeline de Meta Ads. PURO.
 *
 * Dias são strings 'yyyy-MM-dd' no fuso da conta (America/Sao_Paulo = UTC-3
 * FIXO, sem horário de verão desde 2019 — mesma premissa do week-range).
 * Janelas são INCLUSIVAS nas duas pontas (casam com o time_range da Meta).
 *
 * A janela de decisão fecha em D-attributionSettleDays (default D-3): a Meta
 * reajusta atribuição retroativamente, então decidir com dado de ontem é
 * decidir com número que ainda vai mudar.
 */

import type { AdsRules } from '@/lib/ads.config';

export interface DayWindow {
  /** Primeiro dia (inclusivo), 'yyyy-MM-dd'. */
  since: string;
  /** Último dia (inclusivo), 'yyyy-MM-dd'. */
  until: string;
}

const SP_UTC_OFFSET_MS = -3 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/** Dia corrente em America/Sao_Paulo (+offset em dias), como 'yyyy-MM-dd'. */
export function dayInSaoPaulo(now: Date, offsetDays = 0): string {
  return new Date(now.getTime() + SP_UTC_OFFSET_MS + offsetDays * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Aritmética de dias sobre string 'yyyy-MM-dd' (UTC puro — sem TZ envolvida). */
export function addDays(day: string, n: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/** Todos os dias da janela, inclusivos, em ordem. */
export function eachDay(window: DayWindow): string[] {
  const days: string[] = [];
  let cursor = window.since;
  while (cursor <= window.until) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** Janela de decisão: `decisionWindowDays` dias fechando em D-settle (defaults → [D-9, D-3]). */
export function decisionWindow(now: Date, rules: AdsRules): DayWindow {
  const until = dayInSaoPaulo(now, -rules.attributionSettleDays);
  return { since: addDays(until, -(rules.decisionWindowDays - 1)), until };
}

/** Janela imediatamente anterior, de mesmo comprimento (comparação WoW). */
export function previousWindow(w: DayWindow): DayWindow {
  const len = eachDay(w).length;
  const until = addDays(w.since, -1);
  return { since: addDays(until, -(len - 1)), until };
}

/** Janela de tendência: `trendWindowDays` dias fechando em D-settle. */
export function trendWindow(now: Date, rules: AdsRules): DayWindow {
  const until = dayInSaoPaulo(now, -rules.attributionSettleDays);
  return { since: addDays(until, -(rules.trendWindowDays - 1)), until };
}

/**
 * Série móvel: para cada dia da janela `trend`, a janela de `len` dias que
 * termina nele (ex.: CPA 7d móvel da vista Tendência).
 */
export function rollingWindows(
  trend: DayWindow,
  len: number,
): Array<{ end: string; window: DayWindow }> {
  return eachDay(trend).map((end) => ({
    end,
    window: { since: addDays(end, -(len - 1)), until: end },
  }));
}

/**
 * Span total que a query precisa buscar pra montar o relatório completo:
 * do início da primeira janela móvel da tendência (trend.since − (len−1))
 * até D-settle — cobre decisão, WoW e tendência de uma vez.
 */
export function reportDataWindow(now: Date, rules: AdsRules): DayWindow {
  const trend = trendWindow(now, rules);
  const decision = decisionWindow(now, rules);
  const prev = previousWindow(decision);
  const rollingStart = addDays(trend.since, -(rules.decisionWindowDays - 1));
  return { since: rollingStart < prev.since ? rollingStart : prev.since, until: trend.until };
}
