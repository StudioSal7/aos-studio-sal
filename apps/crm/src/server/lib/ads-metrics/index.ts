/**
 * ads-metrics — ÚNICO lar das fórmulas de métrica derivada do pipeline. PURO.
 *
 * Disciplina Σ/Σ (o "erro nº 1 de dashboard de ads" é média das médias): soma
 * numeradores E denominadores da janela, SÓ ENTÃO divide. Nunca usar os campos
 * prontos cpc/cpm/ctr da API (são por linha), nunca tirar média das linhas.
 * Divisão por zero → null → a UI renderiza travessão (jamais Infinity/NaN).
 *
 * Convenções de unidade:
 *   - dinheiro em integer cents (cpmCents, cpaCents);
 *   - taxas como fração 0–1 (ctr, connectRate, hookRate, holdXX) — a UI ×100;
 *   - roas e frequencyProxy adimensionais.
 */

import type { DayWindow } from '../ads-windows/index';

/**
 * Subset estrutural de `meta_insights_daily` que o motor consome — sem import
 * de @repo/db (mantém o módulo puro e os testes sem banco).
 */
export interface DailyRow {
  date: string;
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  spendCents: number;
  impressions: number;
  reachDaily: number;
  linkClicks: number;
  landingPageViews: number;
  video3s: number;
  videoP25: number;
  videoP50: number;
  videoP75: number;
  videoP95: number;
  purchases: number;
  purchaseValueCents: number;
}

export interface WindowTotals {
  spendCents: number;
  impressions: number;
  /** Σ do alcance DIÁRIO — não é alcance único da janela (não-aditivo). */
  reachDailySum: number;
  linkClicks: number;
  landingPageViews: number;
  video3s: number;
  videoP25: number;
  videoP50: number;
  videoP75: number;
  videoP95: number;
  purchases: number;
  purchaseValueCents: number;
  /** Dias com linha na janela (não os dias-calendário da janela). */
  days: number;
}

export interface WindowMetrics {
  totals: WindowTotals;
  /** Σspend / Σimpressões × 1000, em cents. */
  cpmCents: number | null;
  /** Cliques no link / impressões (fração). */
  ctr: number | null;
  /** Landing page views / cliques no link (fração) — o nó de connect rate. */
  connectRate: number | null;
  /** Σspend / Σcompras, em cents. */
  cpaCents: number | null;
  /** Σreceita / Σspend. */
  roas: number | null;
  /** video_3s / impressões (fração) — validado contra o "Hook Rate" do export da Meta. */
  hookRate: number | null;
  /** videoP25 / video_3s (fração). */
  hold25: number | null;
  hold50: number | null;
  hold75: number | null;
  hold95: number | null;
  /**
   * Impressões / Σalcance_diário — PROXY (lower bound) de frequência: alcance
   * não soma entre dias, então a frequência exata de janela não existe no grão
   * diário. Uso só direcional (delta WoW da fadiga); a UI qualifica "proxy".
   */
  frequencyProxy: number | null;
}

/** Divisão segura: denominador 0 → null (UI renderiza —), nunca Infinity/NaN. */
export function safeDiv(num: number, den: number): number | null {
  return den === 0 ? null : num / den;
}

/** Soma os totais das linhas cuja data cai na janela (inclusiva nas duas pontas). */
export function sumTotals(rows: DailyRow[], window: DayWindow): WindowTotals {
  const totals: WindowTotals = {
    spendCents: 0,
    impressions: 0,
    reachDailySum: 0,
    linkClicks: 0,
    landingPageViews: 0,
    video3s: 0,
    videoP25: 0,
    videoP50: 0,
    videoP75: 0,
    videoP95: 0,
    purchases: 0,
    purchaseValueCents: 0,
    days: 0,
  };

  const daysSeen = new Set<string>();
  for (const row of rows) {
    if (row.date < window.since || row.date > window.until) continue;
    totals.spendCents += row.spendCents;
    totals.impressions += row.impressions;
    totals.reachDailySum += row.reachDaily;
    totals.linkClicks += row.linkClicks;
    totals.landingPageViews += row.landingPageViews;
    totals.video3s += row.video3s;
    totals.videoP25 += row.videoP25;
    totals.videoP50 += row.videoP50;
    totals.videoP75 += row.videoP75;
    totals.videoP95 += row.videoP95;
    totals.purchases += row.purchases;
    totals.purchaseValueCents += row.purchaseValueCents;
    daysSeen.add(row.date);
  }
  totals.days = daysSeen.size;

  return totals;
}

/** Soma numeradores e denominadores da janela e SÓ ENTÃO divide. */
export function computeWindowMetrics(rows: DailyRow[], window: DayWindow): WindowMetrics {
  const t = sumTotals(rows, window);
  const cpm = safeDiv(t.spendCents * 1000, t.impressions);

  return {
    totals: t,
    cpmCents: cpm === null ? null : Math.round(cpm),
    ctr: safeDiv(t.linkClicks, t.impressions),
    connectRate: safeDiv(t.landingPageViews, t.linkClicks),
    cpaCents: t.purchases === 0 ? null : Math.round(t.spendCents / t.purchases),
    roas: safeDiv(t.purchaseValueCents, t.spendCents),
    hookRate: safeDiv(t.video3s, t.impressions),
    hold25: safeDiv(t.videoP25, t.video3s),
    hold50: safeDiv(t.videoP50, t.video3s),
    hold75: safeDiv(t.videoP75, t.video3s),
    hold95: safeDiv(t.videoP95, t.video3s),
    frequencyProxy: safeDiv(t.impressions, t.reachDailySum),
  };
}
