import { describe, expect, it } from 'vitest';
import { computeFirstContactMetric } from './index';

const H = 3600; // 1h em segundos

describe('computeFirstContactMetric', () => {
  it('retorna zeros/null para lista vazia', () => {
    expect(computeFirstContactMetric([])).toEqual({
      count: 0,
      medianSeconds: null,
      withinSlaPct: null,
    });
  });

  it('mediana ímpar = elemento do meio', () => {
    const r = computeFirstContactMetric([1 * H, 5 * H, 3 * H]);
    expect(r.count).toBe(3);
    expect(r.medianSeconds).toBe(3 * H);
  });

  it('mediana par = média dos dois centrais', () => {
    const r = computeFirstContactMetric([2 * H, 4 * H, 6 * H, 8 * H]);
    expect(r.medianSeconds).toBe(5 * H);
  });

  it('% no SLA conta <= 24h (inclusive)', () => {
    const r = computeFirstContactMetric([12 * H, 24 * H, 30 * H, 48 * H]);
    expect(r.withinSlaPct).toBe(50);
  });

  it('100% quando todos dentro do SLA', () => {
    const r = computeFirstContactMetric([1 * H, 2 * H, 10 * H]);
    expect(r.withinSlaPct).toBe(100);
  });

  it('ignora durações negativas/inválidas', () => {
    const r = computeFirstContactMetric([-5 * H, 2 * H, NaN, 4 * H]);
    expect(r.count).toBe(2);
    expect(r.medianSeconds).toBe(3 * H);
  });

  it('respeita slaHours customizado', () => {
    const r = computeFirstContactMetric([2 * H, 10 * H], 4);
    expect(r.withinSlaPct).toBe(50);
  });
});
