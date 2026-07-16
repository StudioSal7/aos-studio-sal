import { describe, expect, it } from 'vitest';
import { weekWindowAtOffset } from './week-window';

// 2026-07-16T18:00:00Z = quinta-feira 15:00 em SP (UTC-3).
const THURSDAY_NOW = new Date('2026-07-16T18:00:00.000Z');

describe('weekWindowAtOffset', () => {
  it('offset 0: segunda 00:00 SP desta semana (inclusivo) → segunda seguinte (exclusivo)', () => {
    const w = weekWindowAtOffset(0, THURSDAY_NOW);
    // 00:00 SP = 03:00 UTC
    expect(w.fromUtc.toISOString()).toBe('2026-07-13T03:00:00.000Z');
    expect(w.toUtc.toISOString()).toBe('2026-07-20T03:00:00.000Z');
    expect(w.label).toBe('13/07–19/07');
  });

  it('offset 1: semana seguinte, encadeada sem buraco', () => {
    const current = weekWindowAtOffset(0, THURSDAY_NOW);
    const next = weekWindowAtOffset(1, THURSDAY_NOW);
    expect(next.fromUtc.toISOString()).toBe(current.toUtc.toISOString());
    expect(next.label).toBe('20/07–26/07');
  });

  it('segunda-feira exata mapeia pra própria semana', () => {
    const monday = new Date('2026-07-13T03:00:00.000Z'); // segunda 00:00 SP
    const w = weekWindowAtOffset(0, monday);
    expect(w.fromUtc.toISOString()).toBe('2026-07-13T03:00:00.000Z');
  });

  it('virada de mês e ano no offset', () => {
    const dec = new Date('2026-12-30T18:00:00.000Z'); // quarta 30/12 SP
    const current = weekWindowAtOffset(0, dec);
    const next = weekWindowAtOffset(1, dec);
    expect(current.fromUtc.toISOString()).toBe('2026-12-28T03:00:00.000Z');
    expect(current.label).toBe('28/12–03/01');
    expect(next.fromUtc.toISOString()).toBe('2027-01-04T03:00:00.000Z');
    expect(next.label).toBe('04/01–10/01');
  });
});
