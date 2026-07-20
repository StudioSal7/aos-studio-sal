import { describe, expect, it } from 'vitest';
import { groupEventsByDay, type AgendaDay } from './events-by-day';
import type { RawCalendarEvent } from './types';
import type { WeekWindow } from './week-window';

// Semana 13/07 (segunda) → 19/07 (domingo) de 2026, SP (UTC-3).
const WINDOW: WeekWindow = {
  fromUtc: new Date('2026-07-13T03:00:00.000Z'),
  toUtc: new Date('2026-07-20T03:00:00.000Z'),
  label: '13/07–19/07',
};

function day(days: AgendaDay[], isoDate: string): AgendaDay {
  const d = days.find((x) => x.isoDate === isoDate);
  if (!d) throw new Error(`dia ${isoDate} ausente`);
  return d;
}

describe('groupEventsByDay', () => {
  it('semana vazia = 7 dias seg→dom, todos sem eventos', () => {
    const days = groupEventsByDay([], WINDOW);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.isoDate)).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
    ]);
    expect(day(days, '2026-07-13').dayLabel).toBe('seg 13/07');
    expect(day(days, '2026-07-19').dayLabel).toBe('dom 19/07');
    expect(days.every((d) => d.events.length === 0)).toBe(true);
  });

  it('evento 23:30 SP fica no dia SP, não vaza pro dia UTC seguinte', () => {
    const events: RawCalendarEvent[] = [
      {
        id: 'e1',
        summary: 'Call tarde da noite',
        // 23:30 SP de 13/07 = 02:30 UTC de 14/07
        start: { dateTime: '2026-07-14T02:30:00.000Z' },
        end: { dateTime: '2026-07-14T03:30:00.000Z' },
      },
    ];
    const days = groupEventsByDay(events, WINDOW);
    expect(day(days, '2026-07-13').events).toHaveLength(1);
    expect(day(days, '2026-07-14').events).toHaveLength(0);
    expect(day(days, '2026-07-13').events[0]?.startLabel).toBe('23:30');
    expect(day(days, '2026-07-13').events[0]?.endLabel).toBe('00:30');
  });

  it('all-day (start.date) cobre [start, end) e vem antes dos com horário', () => {
    const events: RawCalendarEvent[] = [
      {
        id: 'e-timed',
        summary: 'Reunião 10h',
        start: { dateTime: '2026-07-15T13:00:00.000Z' }, // 10:00 SP
        end: { dateTime: '2026-07-15T14:00:00.000Z' },
      },
      {
        id: 'e-allday',
        summary: 'Viagem',
        start: { date: '2026-07-15' },
        end: { date: '2026-07-17' }, // exclusivo → 15 e 16
      },
    ];
    const days = groupEventsByDay(events, WINDOW);
    expect(day(days, '2026-07-15').events.map((e) => e.id)).toEqual(['e-allday', 'e-timed']);
    expect(day(days, '2026-07-16').events.map((e) => e.id)).toEqual(['e-allday']);
    expect(day(days, '2026-07-17').events).toHaveLength(0);
    expect(day(days, '2026-07-15').events[0]?.isAllDay).toBe(true);
  });

  it('eventos do dia ordenados por horário de início', () => {
    const events: RawCalendarEvent[] = [
      {
        id: 'late',
        summary: 'Tarde',
        start: { dateTime: '2026-07-14T19:00:00.000Z' }, // 16:00 SP
        end: { dateTime: '2026-07-14T20:00:00.000Z' },
      },
      {
        id: 'early',
        summary: 'Manhã',
        start: { dateTime: '2026-07-14T12:00:00.000Z' }, // 09:00 SP
        end: { dateTime: '2026-07-14T13:00:00.000Z' },
      },
    ];
    const days = groupEventsByDay(events, WINDOW);
    expect(day(days, '2026-07-14').events.map((e) => e.id)).toEqual(['early', 'late']);
  });

  it('evento que começa antes da janela mas termina dentro não some (clamp no primeiro dia)', () => {
    const events: RawCalendarEvent[] = [
      {
        id: 'crosses-window-start',
        summary: 'Domingo à noite → segunda de madrugada',
        // 22:00 SP de 12/07 (domingo, fora da janela) → 01:00 SP de 13/07 (segunda)
        start: { dateTime: '2026-07-13T01:00:00.000Z' },
        end: { dateTime: '2026-07-13T04:00:00.000Z' },
      },
    ];
    const days = groupEventsByDay(events, WINDOW);
    expect(day(days, '2026-07-13').events).toHaveLength(1);
    expect(day(days, '2026-07-13').events[0]?.startLabel).toBe('22:00');
    expect(day(days, '2026-07-13').events[0]?.endLabel).toBe('01:00');
  });

  it('cancelled é filtrado; sem título vira "(sem título)"', () => {
    const events: RawCalendarEvent[] = [
      {
        id: 'c1',
        status: 'cancelled',
        summary: 'Cancelado',
        start: { dateTime: '2026-07-14T12:00:00.000Z' },
      },
      {
        id: 'n1',
        start: { dateTime: '2026-07-14T15:00:00.000Z' },
        end: { dateTime: '2026-07-14T16:00:00.000Z' },
      },
    ];
    const days = groupEventsByDay(events, WINDOW);
    expect(day(days, '2026-07-14').events).toHaveLength(1);
    expect(day(days, '2026-07-14').events[0]?.summary).toBe('(sem título)');
  });
});
