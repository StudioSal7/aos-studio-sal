import { describe, expect, it } from 'vitest';
import { evaluateMetric, trafficLightGlyph } from './index';

describe('evaluateMetric', () => {
  describe('gte', () => {
    const target = { comparator: 'gte' as const, threshold: 40, yellowMargin: 5 };

    it('value no limiar exato → green', () => {
      expect(evaluateMetric(40, target)).toBe('green');
    });

    it('value acima do limiar → green', () => {
      expect(evaluateMetric(55, target)).toBe('green');
    });

    it('value dentro da margem "quase" → yellow', () => {
      expect(evaluateMetric(36, target)).toBe('yellow');
    });

    it('value no início exato da margem → yellow (inclusivo)', () => {
      expect(evaluateMetric(35, target)).toBe('yellow');
    });

    it('value abaixo da margem → red', () => {
      expect(evaluateMetric(34.9, target)).toBe('red');
    });
  });

  describe('lte', () => {
    const target = { comparator: 'lte' as const, threshold: 4, yellowMargin: 2 };

    it('value no limiar exato → green', () => {
      expect(evaluateMetric(4, target)).toBe('green');
    });

    it('value abaixo do limiar → green', () => {
      expect(evaluateMetric(1, target)).toBe('green');
    });

    it('value dentro da margem "quase" → yellow', () => {
      expect(evaluateMetric(5.5, target)).toBe('yellow');
    });

    it('value no fim exato da margem → yellow (inclusivo, espelha o gte)', () => {
      expect(evaluateMetric(6, target)).toBe('yellow');
    });

    it('value acima da margem → red', () => {
      expect(evaluateMetric(6.1, target)).toBe('red');
    });
  });

  it('yellowMargin 0 é binário (sem faixa amarela)', () => {
    const target = { comparator: 'gte' as const, threshold: 40, yellowMargin: 0 };
    expect(evaluateMetric(40, target)).toBe('green');
    expect(evaluateMetric(39.99, target)).toBe('red');
  });

  it('yellowMargin negativo é tratado como 0', () => {
    const target = { comparator: 'gte' as const, threshold: 40, yellowMargin: -5 };
    expect(evaluateMetric(39, target)).toBe('red');
  });

  it('value null → gray', () => {
    expect(evaluateMetric(null, { comparator: 'gte', threshold: 40, yellowMargin: 5 })).toBe(
      'gray',
    );
  });

  it('value NaN → gray', () => {
    expect(evaluateMetric(NaN, { comparator: 'gte', threshold: 40, yellowMargin: 5 })).toBe(
      'gray',
    );
  });

  it('value Infinity → gray', () => {
    expect(
      evaluateMetric(Infinity, { comparator: 'gte', threshold: 40, yellowMargin: 5 }),
    ).toBe('gray');
  });

  it('target null (sem meta cadastrada) → gray, nunca colore no escuro', () => {
    expect(evaluateMetric(90, null)).toBe('gray');
  });
});

describe('trafficLightGlyph', () => {
  it('mapeia cada status pro glifo certo', () => {
    expect(trafficLightGlyph('green')).toBe('▲');
    expect(trafficLightGlyph('yellow')).toBe('●');
    expect(trafficLightGlyph('red')).toBe('▼');
    expect(trafficLightGlyph('gray')).toBe('');
  });
});
