import { describe, expect, it } from 'vitest';
import { lastNWeeks, type WeekRange } from './index';

// 2026-07-13T15:00:00Z = segunda-feira 12:00 em SP (UTC-3). Escolhida numa
// segunda de propósito, pra fixar o início da semana corrente sem ambiguidade.
const MONDAY_NOW = new Date('2026-07-13T15:00:00.000Z');

// Acesso seguro por índice (tsconfig usa noUncheckedIndexedAccess).
function at(weeks: WeekRange[], i: number): WeekRange {
  const w = weeks[i];
  if (!w) throw new Error(`semana ${i} ausente`);
  return w;
}

describe('lastNWeeks', () => {
  it('retorna exatamente n semanas, mais recente primeiro', () => {
    const weeks = lastNWeeks(4, MONDAY_NOW);
    expect(weeks).toHaveLength(4);
    expect(at(weeks, 0).isCurrent).toBe(true);
    expect(weeks.slice(1).every((w) => !w.isCurrent)).toBe(true);
    // ordem decrescente no tempo
    for (let i = 1; i < weeks.length; i++) {
      expect(at(weeks, i).from.getTime()).toBeLessThan(at(weeks, i - 1).from.getTime());
    }
  });

  it('semana corrente: segunda 00:00 SP (inclusivo) → segunda seguinte 00:00 SP (exclusivo)', () => {
    const current = at(lastNWeeks(4, MONDAY_NOW), 0);
    // 00:00 SP = 03:00 UTC
    expect(current.from.toISOString()).toBe('2026-07-13T03:00:00.000Z');
    expect(current.to.toISOString()).toBe('2026-07-20T03:00:00.000Z');
    expect(current.label).toBe('13/07–19/07');
  });

  it('semanas anteriores encadeadas sem buraco (to de uma = from da próxima)', () => {
    const weeks = lastNWeeks(4, MONDAY_NOW);
    expect(at(weeks, 1).to.toISOString()).toBe(at(weeks, 0).from.toISOString());
    expect(at(weeks, 2).to.toISOString()).toBe(at(weeks, 1).from.toISOString());
    expect(at(weeks, 1).label).toBe('06/07–12/07');
    expect(at(weeks, 3).from.toISOString()).toBe('2026-06-22T03:00:00.000Z');
  });

  it('meio de semana mapeia pra segunda da mesma semana', () => {
    const wednesday = new Date('2026-07-15T15:00:00.000Z'); // quarta
    const current = at(lastNWeeks(1, wednesday), 0);
    expect(current.from.toISOString()).toBe('2026-07-13T03:00:00.000Z');
    expect(current.label).toBe('13/07–19/07');
  });

  it('virada de ano: semana corrente começa em dezembro do ano anterior', () => {
    const jan = new Date('2026-01-01T15:00:00.000Z'); // quinta 01/01
    const weeks = lastNWeeks(2, jan);
    const current = at(weeks, 0);
    const prev = at(weeks, 1);
    expect(current.from.toISOString()).toBe('2025-12-29T03:00:00.000Z');
    expect(current.label).toBe('29/12–04/01');
    expect(prev.from.toISOString()).toBe('2025-12-22T03:00:00.000Z');
  });
});
