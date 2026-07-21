import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DATE_RANGE,
  isDateRangeOption,
  resolveCustomRange,
  resolveDashboardPeriod,
  resolveDateRange,
} from './index';

// 2026-07-13T15:00:00Z = segunda-feira 12:00 em SP (UTC-3) — mesma constante
// usada em week-range/index.test.ts, pra fixar o início da semana corrente.
const NOW = new Date('2026-07-13T15:00:00.000Z');

describe('resolveDateRange — semanas fechadas em America/Sao_Paulo', () => {
  it('this_week: segunda 00:00 SP (corrente, em curso) até segunda seguinte 00:00 SP', () => {
    const { from, to } = resolveDateRange('this_week', NOW);
    expect(from?.toISOString()).toBe('2026-07-13T03:00:00.000Z');
    expect(to?.toISOString()).toBe('2026-07-20T03:00:00.000Z');
  });

  it('last_week: semana anterior completa', () => {
    const { from, to } = resolveDateRange('last_week', NOW);
    expect(from?.toISOString()).toBe('2026-07-06T03:00:00.000Z');
    expect(to?.toISOString()).toBe('2026-07-13T03:00:00.000Z');
  });

  it('last_4_weeks: 4 semanas contíguas incluindo a corrente', () => {
    const { from, to } = resolveDateRange('last_4_weeks', NOW);
    expect(from?.toISOString()).toBe('2026-06-22T03:00:00.000Z');
    expect(to?.toISOString()).toBe('2026-07-20T03:00:00.000Z');
  });

  it('all: sem limites', () => {
    expect(resolveDateRange('all', NOW)).toEqual({ from: null, to: null });
  });
});

describe('resolveDateRange — mês de calendário em America/Sao_Paulo (UTC-3)', () => {
  it('this_month: 01/07 00:00 SP até 01/08 00:00 SP', () => {
    const { from, to } = resolveDateRange('this_month', NOW);
    expect(from?.toISOString()).toBe('2026-07-01T03:00:00.000Z');
    expect(to?.toISOString()).toBe('2026-08-01T03:00:00.000Z');
  });

  it('last_month: 01/06 00:00 SP até 01/07 00:00 SP', () => {
    const { from, to } = resolveDateRange('last_month', NOW);
    expect(from?.toISOString()).toBe('2026-06-01T03:00:00.000Z');
    expect(to?.toISOString()).toBe('2026-07-01T03:00:00.000Z');
  });

  it('last_month na virada de ano (janeiro → dezembro do ano anterior)', () => {
    const janNow = new Date('2026-01-13T15:00:00.000Z');
    const { from, to } = resolveDateRange('last_month', janNow);
    expect(from?.toISOString()).toBe('2025-12-01T03:00:00.000Z');
    expect(to?.toISOString()).toBe('2026-01-01T03:00:00.000Z');
  });

  it('this_month em dezembro não vaza pro ano seguinte', () => {
    const decNow = new Date('2026-12-05T15:00:00.000Z');
    const { from, to } = resolveDateRange('this_month', decNow);
    expect(from?.toISOString()).toBe('2026-12-01T03:00:00.000Z');
    expect(to?.toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });
});

describe('resolveCustomRange', () => {
  it('intervalo válido: to inclusivo na entrada vira exclusivo internamente', () => {
    const range = resolveCustomRange('2026-07-01', '2026-07-10');
    expect(range?.from?.toISOString()).toBe('2026-07-01T03:00:00.000Z');
    expect(range?.to?.toISOString()).toBe('2026-07-11T03:00:00.000Z');
  });

  it('from > to → null', () => {
    expect(resolveCustomRange('2026-07-10', '2026-07-01')).toBeNull();
  });

  it('formato malformado → null', () => {
    expect(resolveCustomRange('2026-7-1', '2026-07-10')).toBeNull();
  });

  it('data inexistente (2026-02-30) → null', () => {
    expect(resolveCustomRange('2026-02-30', '2026-03-01')).toBeNull();
  });

  it('from ou to ausente → null', () => {
    expect(resolveCustomRange(undefined, '2026-07-10')).toBeNull();
    expect(resolveCustomRange('2026-07-01', undefined)).toBeNull();
  });
});

describe('resolveDashboardPeriod', () => {
  it('range lixo cai no default (this_week)', () => {
    const period = resolveDashboardPeriod({ range: 'lixo' }, NOW);
    expect(period.option).toBe('this_week');
  });

  it('custom sem from/to cai no default', () => {
    const period = resolveDashboardPeriod({ range: 'custom' }, NOW);
    expect(period.option).toBe('this_week');
  });

  it('custom válido resolve com label formatado', () => {
    const period = resolveDashboardPeriod(
      { range: 'custom', from: '2026-07-01', to: '2026-07-10' },
      NOW,
    );
    expect(period.option).toBe('custom');
    expect(period.label).toBe('01/07/26–10/07/26');
  });

  it('preset válido resolve com o label do preset', () => {
    const period = resolveDashboardPeriod({ range: 'last_month' }, NOW);
    expect(period.option).toBe('last_month');
    expect(period.label).toBe('mês passado');
  });
});

describe('isDateRangeOption', () => {
  it('aceita as 7 opções válidas', () => {
    expect(isDateRangeOption('this_week')).toBe(true);
    expect(isDateRangeOption('last_week')).toBe(true);
    expect(isDateRangeOption('last_4_weeks')).toBe(true);
    expect(isDateRangeOption('this_month')).toBe(true);
    expect(isDateRangeOption('last_month')).toBe(true);
    expect(isDateRangeOption('custom')).toBe(true);
    expect(isDateRangeOption('all')).toBe(true);
  });

  it('rejeita valores inválidos, null e undefined (inclusive as janelas rolantes removidas)', () => {
    expect(isDateRangeOption('7d')).toBe(false);
    expect(isDateRangeOption('30d')).toBe(false);
    expect(isDateRangeOption('')).toBe(false);
    expect(isDateRangeOption(null)).toBe(false);
    expect(isDateRangeOption(undefined)).toBe(false);
  });
});

describe('default', () => {
  it('padrão é this_week', () => {
    expect(DEFAULT_DATE_RANGE).toBe('this_week');
  });
});
