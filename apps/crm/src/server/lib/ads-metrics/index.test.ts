import { describe, expect, it } from 'vitest';
import { computeWindowMetrics, safeDiv, sumTotals, type DailyRow } from './index';

const WINDOW = { since: '2026-07-07', until: '2026-07-13' };

function row(overrides: Partial<DailyRow>): DailyRow {
  return {
    date: '2026-07-10',
    adId: 'a1',
    adName: 'AD01',
    campaignId: 'c1',
    campaignName: 'camp frio',
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

describe('ads-metrics / anti média-das-médias', () => {
  it('CPA da janela = Σspend/Σcompras, NUNCA média dos CPAs por linha', () => {
    // Volumes assimétricos (espelho do teste do royal-eagle):
    // linha A: R$100 / 1 compra (CPA 100) · linha B: R$10 / 0 compras
    const rows = [
      row({ spendCents: 10000, purchases: 1, impressions: 1000 }),
      row({ date: '2026-07-11', spendCents: 1000, purchases: 0, impressions: 100000 }),
    ];
    const m = computeWindowMetrics(rows, WINDOW);

    expect(m.cpaCents).toBe(11000); // (10000+1000)/1 — não média de CPAs
    // CPM: Σ/Σ = 11000×1000/101000 ≈ 109 cents — não (10000+10)/2
    expect(m.cpmCents).toBe(109);
    expect(m.cpmCents!).toBeLessThan(200); // média das médias daria ~5005
  });

  it('ROAS da janela = Σreceita/Σspend', () => {
    const rows = [
      row({ spendCents: 58642, purchaseValueCents: 117906, purchases: 2 }),
      row({ date: '2026-07-11', spendCents: 21618, purchaseValueCents: 0 }),
    ];
    const m = computeWindowMetrics(rows, WINDOW);
    expect(m.roas).toBeCloseTo(117906 / 80260, 5); // ≈ 1.469 — blended real
  });
});

describe('ads-metrics / divisão por zero → null, nunca Infinity/NaN', () => {
  it('janela vazia: tudo null (e nunca NaN)', () => {
    const m = computeWindowMetrics([], WINDOW);
    expect(m.cpaCents).toBeNull();
    expect(m.cpmCents).toBeNull();
    expect(m.ctr).toBeNull();
    expect(m.connectRate).toBeNull();
    expect(m.roas).toBeNull();
    expect(m.hookRate).toBeNull();
    expect(m.hold75).toBeNull();
    expect(m.frequencyProxy).toBeNull();
  });

  it('zero compras → cpa null; zero 3s → holds null', () => {
    const m = computeWindowMetrics([row({ spendCents: 5000, impressions: 100 })], WINDOW);
    expect(m.cpaCents).toBeNull();
    expect(m.hold25).toBeNull();
    expect(m.roas).toBe(0); // 0 de receita com spend > 0 é ROAS 0 real, não indefinido
  });

  it('safeDiv nunca devolve Infinity', () => {
    expect(safeDiv(10, 0)).toBeNull();
    expect(safeDiv(0, 0)).toBeNull();
    expect(safeDiv(0, 5)).toBe(0);
  });
});

describe('ads-metrics / fórmulas', () => {
  const rows = [
    row({
      impressions: 18269,
      linkClicks: 393,
      landingPageViews: 322,
      video3s: 5611,
      videoP25: 1720,
      videoP50: 905,
      videoP75: 438,
      videoP95: 200,
      reachDaily: 8000,
      spendCents: 58642,
    }),
    row({ date: '2026-07-11', impressions: 1731, reachDaily: 1000 }),
  ];
  const m = computeWindowMetrics(rows, WINDOW);

  it('hook = video_3s / impressões', () => {
    expect(m.hookRate).toBeCloseTo(5611 / 20000, 6);
  });

  it('hold = pXX / video_3s', () => {
    expect(m.hold25).toBeCloseTo(1720 / 5611, 6);
    expect(m.hold75).toBeCloseTo(438 / 5611, 6);
  });

  it('ctr = cliques no link / impressões; connect = lpv / cliques', () => {
    expect(m.ctr).toBeCloseTo(393 / 20000, 6);
    expect(m.connectRate).toBeCloseTo(322 / 393, 6);
  });

  it('frequencyProxy = impressões / Σalcance_diário (lower bound)', () => {
    expect(m.frequencyProxy).toBeCloseTo(20000 / 9000, 6);
  });
});

describe('ads-metrics / recorte de janela', () => {
  it('filtro inclusivo nas duas pontas; fora da janela não conta', () => {
    const rows = [
      row({ date: '2026-07-06', spendCents: 999999 }), // fora (antes)
      row({ date: '2026-07-07', spendCents: 100 }), // borda inicial
      row({ date: '2026-07-13', spendCents: 200 }), // borda final
      row({ date: '2026-07-14', spendCents: 999999 }), // fora (depois)
    ];
    const t = sumTotals(rows, WINDOW);
    expect(t.spendCents).toBe(300);
    expect(t.days).toBe(2);
  });
});
