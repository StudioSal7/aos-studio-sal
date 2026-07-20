import { describe, expect, it } from 'vitest';
import type { MetaInsightRaw } from '../meta-client/index';
import {
  PURCHASE_PRECEDENCE,
  actionValue,
  findByPrecedence,
  mapInsightRow,
  sumActions,
  toCents,
  toCount,
} from './index';

const BASE_RAW: MetaInsightRaw = {
  date_start: '2026-07-10',
  date_stop: '2026-07-10',
  campaign_id: 'c1',
  campaign_name: '[202601] [VENDAS] [F] – Método SAL — frio',
  adset_id: 's1',
  adset_name: 'adset 1',
  ad_id: 'a1',
  ad_name: 'AD02 - Vídeo - Dedão',
};

describe('meta-insights-mapper / precedência de compra', () => {
  it('mesma compra sob fb_pixel + purchase + omni conta exatamente 1x (nunca soma)', () => {
    const actions = [
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '2' },
      { action_type: 'purchase', value: '2' },
      { action_type: 'omni_purchase', value: '2' },
    ];
    expect(findByPrecedence(actions, PURCHASE_PRECEDENCE)).toBe(2);

    const row = mapInsightRow({ ...BASE_RAW, actions });
    expect(row.purchases).toBe(2); // 2, jamais 6
  });

  it('receita idem: precedência sobre action_values, em cents', () => {
    const row = mapInsightRow({
      ...BASE_RAW,
      action_values: [
        { action_type: 'offsite_conversion.fb_pixel_purchase', value: '1179.06' },
        { action_type: 'purchase', value: '1179.06' },
        { action_type: 'omni_purchase', value: '1179.06' },
      ],
    });
    expect(row.purchaseValueCents).toBe(117906); // 1x, jamais 3x
  });

  it('fallback de precedência: sem fb_pixel_purchase, usa purchase', () => {
    const actions = [
      { action_type: 'omni_purchase', value: '3' },
      { action_type: 'purchase', value: '3' },
    ];
    expect(findByPrecedence(actions, PURCHASE_PRECEDENCE)).toBe(3);
  });

  it('type presente com valor 0 vence o fallback (presença > valor)', () => {
    const actions = [
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '0' },
      { action_type: 'purchase', value: '5' },
    ];
    expect(findByPrecedence(actions, PURCHASE_PRECEDENCE)).toBe(0);
  });
});

describe('meta-insights-mapper / zero é 0, nunca null', () => {
  it('linha sem actions/action_values mapeia todas as contagens para 0', () => {
    const row = mapInsightRow(BASE_RAW);
    expect(row.purchases).toBe(0);
    expect(row.purchaseValueCents).toBe(0);
    expect(row.video3s).toBe(0);
    expect(row.videoP25).toBe(0);
    expect(row.landingPageViews).toBe(0);
    expect(row.linkClicks).toBe(0);
    expect(row.spendCents).toBe(0);
    expect(row.impressions).toBe(0);
    expect(row.reachDaily).toBe(0);
    expect(row.actionsRaw).toEqual({ actions: [], action_values: [] });
  });
});

describe('meta-insights-mapper / dinheiro em cents', () => {
  it('toCents("586.42") = 58642', () => {
    expect(toCents('586.42')).toBe(58642);
  });

  it('toCents arredonda ponto flutuante (evita 0.1+0.2)', () => {
    expect(toCents('19.99')).toBe(1999);
    expect(toCents('0.005')).toBe(1);
  });

  it('toCents/toCount de lixo → 0', () => {
    expect(toCents(undefined)).toBe(0);
    expect(toCents('abc')).toBe(0);
    expect(toCount(undefined)).toBe(0);
  });
});

describe('meta-insights-mapper / fontes de vídeo e página', () => {
  it('video_3s vem de actions[video_view] (não existe field próprio)', () => {
    const row = mapInsightRow({
      ...BASE_RAW,
      actions: [{ action_type: 'video_view', value: '5611' }],
    });
    expect(row.video3s).toBe(5611);
  });

  it('p25–p95 somam os arrays top-level', () => {
    const row = mapInsightRow({
      ...BASE_RAW,
      video_p25_watched_actions: [
        { action_type: 'video_view', value: '100' },
        { action_type: 'video_view', value: '20' },
      ],
      video_p75_watched_actions: [{ action_type: 'video_view', value: '30' }],
    });
    expect(row.videoP25).toBe(120);
    expect(row.videoP75).toBe(30);
    expect(row.videoP50).toBe(0);
  });

  it('landing_page_views vem de actions[landing_page_view]', () => {
    const row = mapInsightRow({
      ...BASE_RAW,
      actions: [{ action_type: 'landing_page_view', value: '322' }],
    });
    expect(row.landingPageViews).toBe(322);
  });

  it('link_clicks prefere o field inline_link_clicks', () => {
    const row = mapInsightRow({
      ...BASE_RAW,
      inline_link_clicks: '393',
      actions: [{ action_type: 'link_click', value: '999' }],
    });
    expect(row.linkClicks).toBe(393);
  });

  it('link_clicks cai para actions[link_click] quando o field está ausente', () => {
    const row = mapInsightRow({
      ...BASE_RAW,
      actions: [{ action_type: 'link_click', value: '41' }],
    });
    expect(row.linkClicks).toBe(41);
  });
});

describe('meta-insights-mapper / helpers', () => {
  it('actionValue acha um type específico; ausente → 0', () => {
    const list = [{ action_type: 'video_view', value: '7' }];
    expect(actionValue(list, 'video_view')).toBe(7);
    expect(actionValue(list, 'lead')).toBe(0);
    expect(actionValue(undefined, 'lead')).toBe(0);
  });

  it('sumActions soma tudo (uso restrito aos arrays de vídeo)', () => {
    expect(sumActions([{ action_type: 'a', value: '1.5' }, { action_type: 'b', value: '2' }])).toBe(3.5);
    expect(sumActions(undefined)).toBe(0);
  });

  it('grão diário preservado: date = date_start', () => {
    const row = mapInsightRow(BASE_RAW);
    expect(row.date).toBe('2026-07-10');
    expect(row.adId).toBe('a1');
    expect(row.adName).toBe('AD02 - Vídeo - Dedão');
  });
});
