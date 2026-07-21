/**
 * ads-report — montagem PURA do relatório completo do dashboard /trafego:
 * linhas diárias cruas + config + now → view models das 3 vistas + KPIs.
 * Toda a derivação do dashboard é testável sem DB e sem React.
 *
 * Segmentação: por criativo × segmento (campanha → segmento via config).
 * KPIs de conta: blended POR SEGMENTO + blended total (rentabilidade real) —
 * diagnóstico separado do veredito, nunca misturados na mesma tabela.
 */

import type { AdsConfig } from '@/lib/ads.config';
import {
  computeWindowMetrics,
  type DailyRow,
  type WindowMetrics,
  safeDiv,
} from '../ads-metrics/index';
import { UNCLASSIFIED_SEGMENT, classifySegment } from '../ads-segment/index';
import { decide, type Decision } from '../ads-decision-engine/index';
import {
  decisionWindow,
  previousWindow,
  rollingWindows,
  trendWindow,
  type DayWindow,
} from '../ads-windows/index';

export interface CreativeDecisionRow {
  adId: string;
  adName: string;
  campaignName: string;
  segment: string;
  metrics: WindowMetrics;
  decision: Decision;
}

export interface RetentionStep {
  label: '3s' | 'p25' | 'p50' | 'p75' | 'p95';
  count: number;
  /** Retenção sobre o degrau ANTERIOR (3s usa impressões como base = hook). */
  pctOfPrev: number | null;
}

export interface RetentionCurveRow {
  adId: string;
  adName: string;
  segment: string;
  impressions: number;
  steps: RetentionStep[];
}

export interface TrendPoint {
  /** Último dia da janela móvel. */
  end: string;
  spendCents: number;
  cpaCents: number | null;
  hookRate: number | null;
  frequencyProxy: number | null;
}

export interface TrendSeries {
  adId: string;
  adName: string;
  segment: string;
  points: TrendPoint[];
}

export interface TrafegoReport {
  /** Janela de decisão (7d fechada em D-settle). */
  window: DayWindow;
  previousRange: DayWindow;
  trendRange: DayWindow;
  /** Segmentos na ordem do config + nao_classificado (se houver linhas nele). */
  segments: string[];
  decisionRows: Record<string, CreativeDecisionRow[]>;
  curves: Record<string, RetentionCurveRow[]>;
  trends: Record<string, TrendSeries[]>;
  kpis: { bySegment: Record<string, WindowMetrics>; blendedTotal: WindowMetrics };
  /** Campanhas fora da convenção de nome (badge de denúncia). */
  unclassifiedCampaigns: string[];
}

interface AdGroup {
  adId: string;
  adName: string;
  campaignName: string;
  segment: string;
  rows: DailyRow[];
}

/** Agrupa por anúncio; nome/campanha = os do dia mais recente (histórico preserva o nome do dia). */
function groupByAd(rows: DailyRow[], config: AdsConfig): AdGroup[] {
  const byAd = new Map<string, AdGroup>();
  for (const row of rows) {
    const existing = byAd.get(row.adId);
    if (!existing) {
      byAd.set(row.adId, {
        adId: row.adId,
        adName: row.adName,
        campaignName: row.campaignName,
        segment: classifySegment(row.campaignName, config.segments),
        rows: [row],
      });
    } else {
      existing.rows.push(row);
      const latest = existing.rows.reduce((a, b) => (a.date >= b.date ? a : b));
      existing.adName = latest.adName;
      existing.campaignName = latest.campaignName;
      existing.segment = classifySegment(latest.campaignName, config.segments);
    }
  }
  return [...byAd.values()];
}

function retentionSteps(m: WindowMetrics): RetentionStep[] {
  const t = m.totals;
  return [
    // 3s reusa m.hookRate (não recalcula) — vídeo_3s/impressões é a MESMA
    // fórmula do hook da vista Decisão; único lar em ads-metrics.
    { label: '3s', count: t.video3s, pctOfPrev: m.hookRate },
    { label: 'p25', count: t.videoP25, pctOfPrev: safeDiv(t.videoP25, t.video3s) },
    { label: 'p50', count: t.videoP50, pctOfPrev: safeDiv(t.videoP50, t.videoP25) },
    { label: 'p75', count: t.videoP75, pctOfPrev: safeDiv(t.videoP75, t.videoP50) },
    { label: 'p95', count: t.videoP95, pctOfPrev: safeDiv(t.videoP95, t.videoP75) },
  ];
}

export function buildTrafegoReport(rows: DailyRow[], config: AdsConfig, now: Date): TrafegoReport {
  const window = decisionWindow(now, config.rules);
  const previousRange = previousWindow(window);
  const trendRange = trendWindow(now, config.rules);

  const groups = groupByAd(rows, config);

  const segmentsSeen = new Set(groups.map((g) => g.segment));
  const segments = [
    ...config.segments.map((s) => s.key),
    ...(segmentsSeen.has(UNCLASSIFIED_SEGMENT) ? [UNCLASSIFIED_SEGMENT] : []),
  ];

  const decisionRows: Record<string, CreativeDecisionRow[]> = {};
  const curves: Record<string, RetentionCurveRow[]> = {};
  const trends: Record<string, TrendSeries[]> = {};
  for (const key of segments) {
    decisionRows[key] = [];
    curves[key] = [];
    trends[key] = [];
  }

  const rolling = rollingWindows(trendRange, config.rules.decisionWindowDays);

  for (const group of groups) {
    const current = computeWindowMetrics(group.rows, window);
    const hasActivityInWindow = current.totals.days > 0;

    if (hasActivityInWindow) {
      const prevMetrics = computeWindowMetrics(group.rows, previousRange);
      const targets = config.targets[group.segment] ?? { cpaTargetCents: null, roasFloor: null };
      const decision = decide({
        current,
        previous: prevMetrics.totals.days > 0 ? prevMetrics : null,
        targets,
        rules: config.rules,
      });

      decisionRows[group.segment]?.push({
        adId: group.adId,
        adName: group.adName,
        campaignName: group.campaignName,
        segment: group.segment,
        metrics: current,
        decision,
      });

      curves[group.segment]?.push({
        adId: group.adId,
        adName: group.adName,
        segment: group.segment,
        impressions: current.totals.impressions,
        steps: retentionSteps(current),
      });
    }

    const trendTotals = computeWindowMetrics(group.rows, trendRange).totals;
    if (trendTotals.spendCents > 0) {
      trends[group.segment]?.push({
        adId: group.adId,
        adName: group.adName,
        segment: group.segment,
        points: rolling.map(({ end, window: w }) => {
          const m = computeWindowMetrics(group.rows, w);
          return {
            end,
            spendCents: m.totals.spendCents,
            cpaCents: m.cpaCents,
            hookRate: m.hookRate,
            frequencyProxy: m.frequencyProxy,
          };
        }),
      });
    }
  }

  for (const key of segments) {
    decisionRows[key]?.sort((a, b) => b.metrics.totals.spendCents - a.metrics.totals.spendCents);
    curves[key]?.sort((a, b) => b.impressions - a.impressions);
    trends[key]?.sort((a, b) => a.adName.localeCompare(b.adName));
  }

  const bySegment: Record<string, WindowMetrics> = {};
  for (const key of segments) {
    const segRows = groups.filter((g) => g.segment === key).flatMap((g) => g.rows);
    bySegment[key] = computeWindowMetrics(segRows, window);
  }

  return {
    window,
    previousRange,
    trendRange,
    segments,
    decisionRows,
    curves,
    trends,
    kpis: { bySegment, blendedTotal: computeWindowMetrics(rows, window) },
    unclassifiedCampaigns: [
      ...new Set(
        groups.filter((g) => g.segment === UNCLASSIFIED_SEGMENT).map((g) => g.campaignName),
      ),
    ],
  };
}
