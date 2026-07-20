import { describe, expect, it } from 'vitest';
import { adsConfig, type AdsConfig } from '@/lib/ads.config';
import type { DailyRow } from '../ads-metrics/index';
import { buildTrafegoReport } from './index';

// NOW fixo: decisão = [2026-07-07, 2026-07-13], WoW = [2026-06-30, 2026-07-06]
const NOW = new Date('2026-07-16T15:00:00Z');

// Config de teste com alvos cravados (o de produção fica null)
const CONFIG: AdsConfig = {
  ...adsConfig,
  targets: {
    frio: { cpaTargetCents: 20000, roasFloor: 3.0 },
    quente: { cpaTargetCents: 15000, roasFloor: 4.0 },
  },
};

function row(overrides: Partial<DailyRow>): DailyRow {
  return {
    date: '2026-07-10',
    adId: 'a1',
    adName: 'AD01',
    campaignId: 'c1',
    campaignName: 'campanha frio',
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

describe('ads-report / buildTrafegoReport', () => {
  const rows: DailyRow[] = [
    // frio: AD01 com volume e ROAS bom → escalar
    row({ adId: 'a1', adName: 'AD01', spendCents: 80000, purchases: 5, purchaseValueCents: 300000, impressions: 20000, video3s: 6000, videoP25: 2000, videoP50: 1000, videoP75: 500, videoP95: 200 }),
    // quente: AD02 gasto de teste → volume_insuficiente
    row({ adId: 'a2', adName: 'AD02', campaignName: 'rmkt 30d', spendCents: 10000, impressions: 3000 }),
    // fora de convenção → nao_classificado
    row({ adId: 'a3', adName: 'AD03', campaignName: '[202601] [LP] [F] – Método SAL', spendCents: 70000, purchases: 1, purchaseValueCents: 100000 }),
    // fora da janela de decisão (só tendência)
    row({ adId: 'a1', adName: 'AD01', date: '2026-06-20', spendCents: 50000, purchases: 2, purchaseValueCents: 150000 }),
  ];

  const report = buildTrafegoReport(rows, CONFIG, NOW);

  it('janelas derivadas do config (7d fechada em D-3)', () => {
    expect(report.window).toEqual({ since: '2026-07-07', until: '2026-07-13' });
    expect(report.previousRange).toEqual({ since: '2026-06-30', until: '2026-07-06' });
    expect(report.trendRange).toEqual({ since: '2026-06-16', until: '2026-07-13' });
  });

  it('bucketing por segmento + nao_classificado só quando existe', () => {
    expect(report.segments).toEqual(['frio', 'quente', 'nao_classificado']);
    expect(report.decisionRows.frio!.map((r) => r.adId)).toEqual(['a1']);
    expect(report.decisionRows.quente!.map((r) => r.adId)).toEqual(['a2']);
    expect(report.decisionRows.nao_classificado!.map((r) => r.adId)).toEqual(['a3']);
  });

  it('decisão usa os alvos DO SEGMENTO (frio escalar; quente sem volume; não classificado sem alvo)', () => {
    expect(report.decisionRows.frio![0]!.decision.flag).toBe('escalar');
    expect(report.decisionRows.quente![0]!.decision.flag).toBe('volume_insuficiente');
    expect(report.decisionRows.nao_classificado![0]!.decision.flag).toBe('sem_alvo');
  });

  it('campanha fora da convenção é denunciada', () => {
    expect(report.unclassifiedCampaigns).toEqual(['[202601] [LP] [F] – Método SAL']);
  });

  it('KPI blended por segmento = Σ/Σ das linhas do segmento na janela', () => {
    expect(report.kpis.bySegment.frio!.totals.spendCents).toBe(80000); // linha de 20/06 fica fora da janela
    expect(report.kpis.bySegment.frio!.cpaCents).toBe(16000);
  });

  it('blendedTotal = Σ/Σ de TODAS as linhas — nunca média dos segmentos', () => {
    const total = report.kpis.blendedTotal;
    expect(total.totals.spendCents).toBe(160000); // 80000 + 10000 + 70000
    expect(total.totals.purchases).toBe(6);
    expect(total.cpaCents).toBe(Math.round(160000 / 6));
    // média dos CPAs por segmento seria outra coisa (16000, null, 70000 → ~43000)
    expect(total.cpaCents).not.toBe(43000);
  });

  it('curva de retenção: degraus com % sobre o anterior (3s sobre impressões = hook)', () => {
    const curve = report.curves.frio![0]!;
    expect(curve.steps.map((s) => s.label)).toEqual(['3s', 'p25', 'p50', 'p75', 'p95']);
    expect(curve.steps[0]!.pctOfPrev).toBeCloseTo(6000 / 20000, 6);
    expect(curve.steps[1]!.pctOfPrev).toBeCloseTo(2000 / 6000, 6);
  });

  it('tendência: só anúncios com spend na janela de tendência; pontos = janelas móveis', () => {
    const serie = report.trends.frio!.find((t) => t.adId === 'a1')!;
    expect(serie.points).toHaveLength(28);
    const lastPoint = serie.points.at(-1)!;
    expect(lastPoint.end).toBe('2026-07-13');
    expect(lastPoint.cpaCents).toBe(16000);
  });

  it('anúncio sem atividade na janela de decisão não entra na tabela (mas pode estar na tendência)', () => {
    const inDecision = Object.values(report.decisionRows).flat().some((r) => r.adId === 'a1');
    expect(inDecision).toBe(true);
    // a3 não tem linha na tendência com spend? tem (70000 em 10/07 ∈ tendência) → presente
    expect(report.trends.nao_classificado!.some((t) => t.adId === 'a3')).toBe(true);
  });
});
