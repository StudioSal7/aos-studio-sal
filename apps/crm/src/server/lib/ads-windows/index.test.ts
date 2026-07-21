import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayInSaoPaulo,
  decisionWindow,
  eachDay,
  previousWindow,
  reportDataWindow,
  rollingWindows,
  trendWindow,
} from './index';
import type { AdsRules } from '@/lib/ads.config';

// 2026-07-16 15:00 UTC = 12:00 em SP
const NOW = new Date('2026-07-16T15:00:00Z');

const RULES: AdsRules = {
  stopLossMultiple: 2,
  winnerMultiple: 10,
  testBarMultiple: 3,
  decisionWindowDays: 7,
  trendWindowDays: 28,
  attributionSettleDays: 3,
};

describe('ads-windows / dayInSaoPaulo', () => {
  it('converte instante UTC para dia SP', () => {
    expect(dayInSaoPaulo(NOW)).toBe('2026-07-16');
    expect(dayInSaoPaulo(NOW, -3)).toBe('2026-07-13');
  });

  it('borda de TZ: 00:30 UTC ainda é o dia anterior em SP (UTC-3)', () => {
    expect(dayInSaoPaulo(new Date('2026-07-16T00:30:00Z'))).toBe('2026-07-15');
    expect(dayInSaoPaulo(new Date('2026-07-16T03:30:00Z'))).toBe('2026-07-16');
  });
});

describe('ads-windows / janelas', () => {
  it('decisionWindow = 7d fechada em D-3', () => {
    expect(decisionWindow(NOW, RULES)).toEqual({ since: '2026-07-07', until: '2026-07-13' });
  });

  it('previousWindow encadeia sem gap nem overlap', () => {
    const w = decisionWindow(NOW, RULES);
    const prev = previousWindow(w);
    expect(prev).toEqual({ since: '2026-06-30', until: '2026-07-06' });
    expect(addDays(prev.until, 1)).toBe(w.since);
  });

  it('trendWindow = 28d fechada em D-3', () => {
    expect(trendWindow(NOW, RULES)).toEqual({ since: '2026-06-16', until: '2026-07-13' });
  });

  it('eachDay lista dias inclusivos, atravessando virada de mês', () => {
    expect(eachDay({ since: '2026-06-29', until: '2026-07-02' })).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
    ]);
  });

  it('rollingWindows: uma janela de 7d terminando em cada dia da tendência', () => {
    const rolling = rollingWindows({ since: '2026-07-10', until: '2026-07-13' }, 7);
    expect(rolling).toHaveLength(4);
    expect(rolling[0]).toEqual({
      end: '2026-07-10',
      window: { since: '2026-07-04', until: '2026-07-10' },
    });
    expect(rolling.at(-1)!.window).toEqual({ since: '2026-07-07', until: '2026-07-13' });
  });

  it('reportDataWindow cobre decisão + WoW + primeira janela móvel da tendência', () => {
    const span = reportDataWindow(NOW, RULES);
    expect(span).toEqual({ since: '2026-06-10', until: '2026-07-13' });
    const prev = previousWindow(decisionWindow(NOW, RULES));
    expect(span.since <= prev.since).toBe(true);
  });
});
