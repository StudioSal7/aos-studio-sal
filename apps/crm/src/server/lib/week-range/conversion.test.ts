import { describe, expect, it } from 'vitest';
import { conversionPct, weekDelta, weeklyConversions } from './conversion';

describe('conversionPct', () => {
  it('taxa inteira arredondada', () => {
    expect(conversionPct(10, 3)).toBe(30);
    expect(conversionPct(3, 1)).toBe(33); // 33.33 → 33
    expect(conversionPct(3, 2)).toBe(67); // 66.66 → 67
  });

  it('denominador 0 → null (não chuta)', () => {
    expect(conversionPct(0, 0)).toBeNull();
    expect(conversionPct(0, 5)).toBeNull();
  });

  it('numerador 0 com base > 0 → 0%', () => {
    expect(conversionPct(4, 0)).toBe(0);
  });

  it('acima de 100% é permitido (skips no kanban podem inflar uma etapa)', () => {
    expect(conversionPct(2, 3)).toBe(150);
  });
});

describe('weeklyConversions', () => {
  it('pares adjacentes, comprimento n-1', () => {
    expect(weeklyConversions([10, 5, 2, 1])).toEqual([50, 40, 50]);
  });

  it('propaga null onde a etapa anterior é 0', () => {
    expect(weeklyConversions([4, 0, 0])).toEqual([0, null]);
  });
});

describe('weekDelta', () => {
  it('up quando o valor atual é maior', () => {
    expect(weekDelta(2, 5)).toBe('up');
  });

  it('down quando o valor atual é menor', () => {
    expect(weekDelta(5, 2)).toBe('down');
  });

  it('flat quando os valores são iguais', () => {
    expect(weekDelta(3, 3)).toBe('flat');
  });

  it('null quando não há semana anterior (1ª coluna do grid)', () => {
    expect(weekDelta(undefined, 3)).toBeNull();
    expect(weekDelta(null, 3)).toBeNull();
  });
});
