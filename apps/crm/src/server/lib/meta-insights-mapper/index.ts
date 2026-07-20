/**
 * meta-insights-mapper — deep module PURO: linha crua da Graph API → linha da
 * tabela-fato `meta_insights_daily` (grão dia × anúncio).
 *
 * Regras de integridade (pagas em produção no ba-hub — não relaxar):
 *   - Compra/receita por PRECEDÊNCIA ESTRITA de action_type: a Meta reporta a
 *     MESMA compra sob fb_pixel_purchase, purchase e omni_purchase ao mesmo
 *     tempo — somar entre types dobra/triplica ROAS. `find`, nunca `sum`.
 *   - Contagem ausente → 0, nunca NULL (NULL ≠ 0 quebra agregação no Postgres).
 *   - Dinheiro em integer cents (Math.round(valor × 100)).
 *   - Payload cru { actions, action_values } preservado em `actions_raw` —
 *     fórmula errada se corrige na query, sem re-sync.
 *
 * Fontes por campo (validadas pela sondagem `pnpm --filter crm meta-probe`):
 *   - link_clicks: `inline_link_clicks` (field), fallback actions[link_click]
 *   - landing_page_views: actions[landing_page_view]
 *   - video_3s: actions[video_view] (NÃO existe field próprio de 3s)
 *   - video_p25..p95: arrays top-level video_pXX_watched_actions (somados)
 */

import type { NewMetaInsightDaily } from '@repo/db/schema';
import type { MetaAction, MetaInsightRaw } from '../meta-client/index';

export const PURCHASE_PRECEDENCE = [
  'offsite_conversion.fb_pixel_purchase',
  'purchase',
  'omni_purchase',
] as const;

function parseNum(value: string | undefined): number {
  const n = Number.parseFloat(value ?? '');
  return Number.isFinite(n) ? n : 0;
}

/** "586.42" → 58642. Ausente/inválido → 0. */
export function toCents(decimal: string | undefined): number {
  return Math.round(parseNum(decimal) * 100);
}

/** Contagem inteira de um field escalar ("393" → 393). Ausente → 0. */
export function toCount(value: string | undefined): number {
  return Math.round(parseNum(value));
}

/** Valor de UM action_type específico dentro de um array de actions. Ausente → 0. */
export function actionValue(list: MetaAction[] | undefined, actionType: string): number {
  const found = list?.find((a) => a.action_type === actionType);
  return found ? parseNum(found.value) : 0;
}

/**
 * Primeiro action_type PRESENTE na ordem de precedência — mesmo que valha 0.
 * É a disciplina anti-duplicação: nunca somar tipos que reportam o mesmo evento.
 */
export function findByPrecedence(
  list: MetaAction[] | undefined,
  precedence: readonly string[],
): number {
  for (const type of precedence) {
    const found = list?.find((a) => a.action_type === type);
    if (found) return parseNum(found.value);
  }
  return 0;
}

/** Soma de um array top-level (só vídeo pXX — NUNCA usar em actions/action_values). */
export function sumActions(list: MetaAction[] | undefined): number {
  return (list ?? []).reduce((sum, a) => sum + parseNum(a.value), 0);
}

export function mapInsightRow(raw: MetaInsightRaw): NewMetaInsightDaily {
  const linkClicksField = toCount(raw.inline_link_clicks);

  return {
    date: raw.date_start,
    adId: raw.ad_id,
    campaignId: raw.campaign_id,
    campaignName: raw.campaign_name,
    adsetId: raw.adset_id,
    adsetName: raw.adset_name,
    adName: raw.ad_name,

    spendCents: toCents(raw.spend),
    impressions: toCount(raw.impressions),
    reachDaily: toCount(raw.reach),

    linkClicks: linkClicksField > 0 ? linkClicksField : Math.round(actionValue(raw.actions, 'link_click')),
    landingPageViews: Math.round(actionValue(raw.actions, 'landing_page_view')),

    video3s: Math.round(actionValue(raw.actions, 'video_view')),
    videoP25: Math.round(sumActions(raw.video_p25_watched_actions)),
    videoP50: Math.round(sumActions(raw.video_p50_watched_actions)),
    videoP75: Math.round(sumActions(raw.video_p75_watched_actions)),
    videoP95: Math.round(sumActions(raw.video_p95_watched_actions)),

    purchases: Math.round(findByPrecedence(raw.actions, PURCHASE_PRECEDENCE)),
    purchaseValueCents: Math.round(findByPrecedence(raw.action_values, PURCHASE_PRECEDENCE) * 100),

    actionsRaw: { actions: raw.actions ?? [], action_values: raw.action_values ?? [] },
  };
}
