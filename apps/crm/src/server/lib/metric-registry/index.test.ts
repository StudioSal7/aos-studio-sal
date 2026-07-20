import { describe, expect, it } from 'vitest';
import { isMetricKey, metricByKey, METRIC_REGISTRY } from './index';

describe('METRIC_REGISTRY', () => {
  it('chaves são únicas', () => {
    const keys = METRIC_REGISTRY.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('métricas de fluxo têm numerator e denominator distintos', () => {
    for (const m of METRIC_REGISTRY) {
      if (m.flow) expect(m.flow.numerator).not.toBe(m.flow.denominator);
    }
  });

  it('tem exatamente as 9 chaves esperadas', () => {
    expect(METRIC_REGISTRY).toHaveLength(9);
  });
});

describe('isMetricKey', () => {
  it('aceita todas as chaves do registry', () => {
    for (const m of METRIC_REGISTRY) {
      expect(isMetricKey(m.key)).toBe(true);
    }
  });

  it('rejeita chaves desconhecidas', () => {
    expect(isMetricKey('foo')).toBe(false);
    expect(isMetricKey('')).toBe(false);
    expect(isMetricKey('CONV_GLOBAL')).toBe(false);
  });
});

describe('metricByKey', () => {
  it('devolve a entry certa para uma chave válida', () => {
    expect(metricByKey('show_rate')?.label).toBe('agendada → realizada');
  });

  it('devolve undefined para chave desconhecida', () => {
    expect(metricByKey('nao_existe')).toBeUndefined();
  });
});
