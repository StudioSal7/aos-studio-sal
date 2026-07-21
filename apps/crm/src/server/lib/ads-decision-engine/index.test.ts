import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AdsRules, AdsTargets } from '@/lib/ads.config';
import { computeWindowMetrics, type DailyRow, type WindowMetrics } from '../ads-metrics/index';
import { decide, detectFadiga } from './index';

const RULES: AdsRules = {
  stopLossMultiple: 2,
  winnerMultiple: 10,
  testBarMultiple: 3,
  decisionWindowDays: 7,
  trendWindowDays: 28,
  attributionSettleDays: 3,
};

/**
 * Alvos EXPLÍCITOS do teste (o config de produção fica null de propósito):
 * CPA alvo R$200 / piso ROAS 3.0 — os valores da análise manual de 16/07/2026
 * que geraram os vereditos-âncora AD05 escalar / AD02 matar / AD14 volume.
 */
const TARGETS: AdsTargets = { cpaTargetCents: 20000, roasFloor: 3.0 };
const NULL_TARGETS: AdsTargets = { cpaTargetCents: null, roasFloor: null };

const WINDOW = { since: '2026-02-13', until: '2026-07-16' };

function makeRow(overrides: Partial<DailyRow>): DailyRow {
  return {
    date: '2026-02-13',
    adId: 'a1',
    adName: 'AD',
    campaignId: 'c1',
    campaignName: 'camp',
    spendCents: 0,
    impressions: 0,
    reachDaily: 0,
    linkClicks: 0,
    landingPageViews: 0,
    video3s: 0,
    videoP25: 0,
    videoP50: 0,
    videoP75: 0,
    videoP95: 0,
    purchases: 0,
    purchaseValueCents: 0,
    ...overrides,
  };
}

function metricsOf(overrides: Partial<DailyRow>): WindowMetrics {
  return computeWindowMetrics([makeRow(overrides)], WINDOW);
}

describe('ads-decision-engine / ordem e branches', () => {
  it('targets null → sem_alvo SEMPRE (nunca chuta), mesmo com números ótimos', () => {
    const d = decide({
      current: metricsOf({ spendCents: 500000, purchases: 50, purchaseValueCents: 5000000 }),
      previous: null,
      targets: NULL_TARGETS,
      rules: RULES,
    });
    expect(d.flag).toBe('sem_alvo');
  });

  it('gate de volume vence winner: ROAS 12x com gasto de teste → volume_insuficiente', () => {
    const d = decide({
      current: metricsOf({ spendCents: 10000, purchases: 1, purchaseValueCents: 120000 }),
      previous: null,
      targets: TARGETS,
      rules: RULES,
    });
    expect(d.flag).toBe('volume_insuficiente');
    expect(d.reason).toContain('R$'); // motivo carrega os números
  });

  it('winner: ROAS ≥ 10x com volume', () => {
    const d = decide({
      current: metricsOf({ spendCents: 80000, purchases: 4, purchaseValueCents: 900000 }),
      previous: null,
      targets: TARGETS,
      rules: RULES,
    });
    expect(d.flag).toBe('winner');
  });

  it('matar por stop-loss: 2× CPA alvo gasto sem conversão', () => {
    const d = decide({
      current: metricsOf({ spendCents: 60000, purchases: 0 }),
      previous: null,
      targets: TARGETS,
      rules: RULES,
    });
    expect(d.flag).toBe('matar');
    expect(d.reason).toContain('sem nenhuma conversão');
  });

  it('zona morta [2×, 3×): stop-loss mata ANTES da barra de teste (não fica volume_insuficiente)', () => {
    // targets 20000/3.0 → stopLoss 40000, testBar 60000; gasto 45000 = 2,25× (dentro da zona morta antiga)
    const d = decide({
      current: metricsOf({ spendCents: 45000, purchases: 0 }),
      previous: null,
      targets: TARGETS,
      rules: RULES,
    });
    expect(d.flag).toBe('matar');
    expect(d.reason).toContain('sem nenhuma conversão');
  });

  it('matar por piso: ROAS abaixo do floor com volume provado', () => {
    const d = decide({
      current: metricsOf({ spendCents: 80000, purchases: 2, purchaseValueCents: 120000 }), // ROAS 1.5
      previous: null,
      targets: TARGETS,
      rules: RULES,
    });
    expect(d.flag).toBe('matar');
    expect(d.reason).toContain('piso');
  });

  it('escalar: CPA ≤ alvo e ROAS ≥ piso com volume', () => {
    const d = decide({
      current: metricsOf({ spendCents: 80000, purchases: 5, purchaseValueCents: 300000 }), // CPA 160, ROAS 3.75
      previous: null,
      targets: TARGETS,
      rules: RULES,
    });
    expect(d.flag).toBe('escalar');
  });

  it('iterar: volume ok, ROAS ≥ piso mas CPA acima do alvo', () => {
    const d = decide({
      current: metricsOf({ spendCents: 90000, purchases: 3, purchaseValueCents: 300000 }), // CPA 300, ROAS 3.33
      previous: null,
      targets: TARGETS,
      rules: RULES,
    });
    expect(d.flag).toBe('iterar');
  });
});

describe('ads-decision-engine / fadiga (ortogonal)', () => {
  const prevHealthy = metricsOf({
    spendCents: 60000,
    purchases: 3,
    purchaseValueCents: 200000,
    impressions: 10000,
    video3s: 3500,
    reachDaily: 8000,
  }); // CPA 200, hook 35%, freq 1.25

  const currentTired = metricsOf({
    spendCents: 70000,
    purchases: 2,
    purchaseValueCents: 140000,
    impressions: 10000,
    video3s: 2800,
    reachDaily: 6000,
  }); // CPA 350 ↑, hook 28% ↓, freq 1.67 ↑

  it('tripla WoW simultânea → fadiga com motivo', () => {
    const f = detectFadiga(currentTired, prevHealthy);
    expect(f.fadiga).toBe(true);
    expect(f.reason).toContain('fadiga');
  });

  it('qualquer dupla (sem a terceira) NÃO dispara', () => {
    const freqDown = metricsOf({
      spendCents: 70000,
      purchases: 2,
      purchaseValueCents: 140000,
      impressions: 10000,
      video3s: 2800,
      reachDaily: 12000, // freq ↓
    });
    expect(detectFadiga(freqDown, prevHealthy).fadiga).toBe(false);
  });

  it('dado esparso (CPA incomputável num dos lados) → false, sem chute', () => {
    const noPurchases = metricsOf({ spendCents: 70000, purchases: 0, impressions: 10000, video3s: 2800, reachDaily: 6000 });
    expect(detectFadiga(noPurchases, prevHealthy).fadiga).toBe(false);
    expect(detectFadiga(currentTired, null).fadiga).toBe(false);
  });

  it('fadiga coexiste com o veredito (flag ortogonal no decide)', () => {
    const d = decide({ current: currentTired, previous: prevHealthy, targets: TARGETS, rules: RULES });
    expect(d.fadiga).toBe(true);
    expect(d.fadigaReason).not.toBeNull();
    expect(d.flag).toBe('matar'); // ROAS 2,0 < piso 3,0 com volume — veredito independe da fadiga
  });
});

// ── Regressão: a análise manual de 16/07/2026 vira teste do motor ────────────
//
// Fixture = export real do Ads Manager (nível anúncio, 2026-02-13→2026-07-16).
// O CSV traz linhas por anúncio×veiculação (AD02 e AD05 têm 2 linhas cada) —
// agregamos por código AD (Σ/Σ) e reconstruímos a receita por linha como
// ROAS × spend (o export carrega ROAS, não receita).

interface CsvAd {
  code: string;
  spendCents: number;
  purchases: number;
  purchaseValueCents: number;
  impressions: number;
  linkClicks: number;
  landingPageViews: number;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function loadFixtureAds(): Map<string, CsvAd> {
  const path = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '__fixtures__/giulia-anuncios-2026-02-13_2026-07-16.csv',
  );
  const lines = readFileSync(path, 'utf-8').split('\n').filter((l) => l.trim() !== '');
  const ads = new Map<string, CsvAd>();

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const name = cols[2] ?? '';
    const code = /^AD\d+/.exec(name)?.[0];
    if (!code) continue;

    const spend = Number.parseFloat(cols[4] ?? '') || 0;
    const purchases = Number.parseInt(cols[10] ?? '', 10) || 0;
    const roas = Number.parseFloat(cols[14] ?? '') || 0;

    const agg = ads.get(code) ?? {
      code,
      spendCents: 0,
      purchases: 0,
      purchaseValueCents: 0,
      impressions: 0,
      linkClicks: 0,
      landingPageViews: 0,
    };
    agg.spendCents += Math.round(spend * 100);
    agg.purchases += purchases;
    agg.purchaseValueCents += Math.round(roas * spend * 100);
    agg.impressions += Number.parseInt(cols[5] ?? '', 10) || 0;
    agg.linkClicks += Number.parseInt(cols[7] ?? '', 10) || 0;
    agg.landingPageViews += Number.parseInt(cols[12] ?? '', 10) || 0;
    ads.set(code, agg);
  }
  return ads;
}

function decideFor(ad: CsvAd) {
  const current = computeWindowMetrics(
    [
      makeRow({
        adId: ad.code,
        adName: ad.code,
        spendCents: ad.spendCents,
        purchases: ad.purchases,
        purchaseValueCents: ad.purchaseValueCents,
        impressions: ad.impressions,
        linkClicks: ad.linkClicks,
        landingPageViews: ad.landingPageViews,
      }),
    ],
    WINDOW,
  );
  return { current, decision: decide({ current, previous: null, targets: TARGETS, rules: RULES }) };
}

describe('ads-decision-engine / regressão do CSV real (análise manual 16/07/2026)', () => {
  const ads = loadFixtureAds();

  it('fixture carrega os anúncios-âncora com os agregados esperados', () => {
    const ad02 = ads.get('AD02')!;
    expect(ad02.spendCents).toBe(80260); // 586,42 + 216,18
    expect(ad02.purchases).toBe(2);

    const ad05 = ads.get('AD05')!;
    expect(ad05.spendCents).toBe(143525); // 94,51 + 1.340,74
    expect(ad05.purchases).toBe(8);

    const ad14 = ads.get('AD14')!;
    expect(ad14.spendCents).toBe(10356);
  });

  it('AD05 → escalar (CPA ~R$179 ≤ alvo R$200, ROAS ~3,29 ≥ piso 3,0, volume ok)', () => {
    const { current, decision } = decideFor(ads.get('AD05')!);
    expect(current.cpaCents).toBe(17941);
    expect(current.roas).toBeCloseTo(3.29, 2);
    expect(decision.flag).toBe('escalar');
  });

  it('AD02 → matar (ROAS ~1,47 abaixo do piso 3,0 com volume provado)', () => {
    const { current, decision } = decideFor(ads.get('AD02')!);
    expect(current.roas).toBeCloseTo(1.47, 2);
    expect(decision.flag).toBe('matar');
    expect(decision.reason).toContain('piso');
  });

  it('AD14 → volume_insuficiente (R$103,56 < barra de R$600), mesmo com ROAS 5,7', () => {
    const { current, decision } = decideFor(ads.get('AD14')!);
    expect(current.roas).toBeCloseTo(5.69, 1);
    expect(decision.flag).toBe('volume_insuficiente');
  });
});
