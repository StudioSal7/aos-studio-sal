/**
 * ads.config.ts — ÚNICA superfície client-specific do pipeline de Meta Ads
 * (template Atlas, instância SAL). Zero hard-code fora daqui.
 *
 * Segmentos: campanha → segmento por padrão de nome (substring case-insensitive,
 * ordem da lista = precedência). Sem match → 'nao_classificado' (badge no dashboard).
 *
 * Targets ficam null DE PROPÓSITO: os números atuais (CPA ~R$197) são blended
 * frio+quente — o backfill separa os segmentos e aí o alvo é cravado POR SEGMENTO,
 * nunca blended. Enquanto null, o motor de decisão devolve `sem_alvo` (fallback
 * honesto, nunca chuta).
 */

export interface SegmentRule {
  key: string;
  /** Termos casados por substring (lowercase) contra o nome da campanha. */
  match: string[];
}

export interface AdsTargets {
  cpaTargetCents: number | null;
  roasFloor: number | null;
}

export interface AdsRules {
  /** 2x CPA alvo gasto sem conversão → flag matar (stop-loss). */
  stopLossMultiple: number;
  /** Retorno (ROAS) ≥ 10x → bunker (fonte de variações). */
  winnerMultiple: number;
  /** Gasto mínimo pra qualquer veredito = 3x CPA alvo. */
  testBarMultiple: number;
  /** Janela de decisão (dias). */
  decisionWindowDays: number;
  /** Janela de tendência (dias). */
  trendWindowDays: number;
  /** Decisão só com janela fechada até D-N (reatribuição da Meta assenta). */
  attributionSettleDays: number;
}

export interface AdsConfig {
  /** Nome da env var com o account id (numérico, SEM prefixo act_). */
  accountRef: string;
  /** TZ da conta de anúncios — as datas dos insights vêm nesse fuso. */
  timezone: string;
  currency: string;
  segments: SegmentRule[];
  conversion: { event: string; trackValue: boolean };
  /** POR SEGMENTO — nunca blended. */
  targets: Record<string, AdsTargets>;
  rules: AdsRules;
  video: { holdVariant: 'p75' };
}

export const adsConfig: AdsConfig = {
  accountRef: 'META_AD_ACCOUNT_ID',
  timezone: 'America/Sao_Paulo',
  currency: 'BRL',
  segments: [
    { key: 'frio', match: ['frio', 'cold', 'aberto'] },
    { key: 'quente', match: ['quente', 'rmkt', 'remarketing'] },
  ],
  conversion: { event: 'offsite_conversion.fb_pixel_purchase', trackValue: true },
  targets: {
    frio: { cpaTargetCents: null, roasFloor: null },
    quente: { cpaTargetCents: null, roasFloor: null },
  },
  rules: {
    stopLossMultiple: 2,
    winnerMultiple: 10,
    testBarMultiple: 3,
    decisionWindowDays: 7,
    trendWindowDays: 28,
    attributionSettleDays: 3,
  },
  video: { holdVariant: 'p75' },
};
