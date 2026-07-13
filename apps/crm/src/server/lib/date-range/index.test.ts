import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DATE_RANGE,
  isDateRangeOption,
  resolveDateRange,
} from './index';

// 2026-07-13T15:00:00Z (meio do mês, sem ambiguidade de fuso — Brasil não
// observa horário de verão desde 2019, então America/Sao_Paulo = UTC-3 fixo).
const NOW = new Date('2026-07-13T15:00:00.000Z');

describe('resolveDateRange — janelas rolantes', () => {
  it('7d: from = agora - 7 dias, to = null', () => {
    const { from, to } = resolveDateRange('7d', NOW);
    expect(from?.toISOString()).toBe('2026-07-06T15:00:00.000Z');
    expect(to).toBeNull();
  });

  it('30d: from = agora - 30 dias, to = null', () => {
    const { from, to } = resolveDateRange('30d', NOW);
    expect(from?.toISOString()).toBe('2026-06-13T15:00:00.000Z');
    expect(to).toBeNull();
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

describe('isDateRangeOption', () => {
  it('aceita as 5 opções válidas', () => {
    expect(isDateRangeOption('7d')).toBe(true);
    expect(isDateRangeOption('30d')).toBe(true);
    expect(isDateRangeOption('this_month')).toBe(true);
    expect(isDateRangeOption('last_month')).toBe(true);
    expect(isDateRangeOption('all')).toBe(true);
  });

  it('rejeita valores inválidos, null e undefined', () => {
    expect(isDateRangeOption('90d')).toBe(false);
    expect(isDateRangeOption('')).toBe(false);
    expect(isDateRangeOption(null)).toBe(false);
    expect(isDateRangeOption(undefined)).toBe(false);
  });
});

describe('default', () => {
  it('padrão é 7d', () => {
    expect(DEFAULT_DATE_RANGE).toBe('7d');
  });
});
