/**
 * Agrupamento puro dos eventos Google numa grade de 7 dias (segunda→domingo)
 * por dia-calendário de America/Sao_Paulo. É o shape que a UI renderiza —
 * nenhum objeto cru da API vaza pro cliente.
 */

import { toZonedTime } from 'date-fns-tz';
import type { RawCalendarEvent } from './types';
import type { WeekWindow } from './week-window';

const TIMEZONE = 'America/Sao_Paulo';
const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export interface AgendaEvent {
  id: string;
  summary: string;
  /** `HH:mm` SP — vazio em all-day. */
  startLabel: string;
  endLabel: string;
  isAllDay: boolean;
  /** Minutos desde 00:00 SP — só pra ordenação (all-day = -1). */
  sortKey: number;
}

export interface AgendaDay {
  /** `yyyy-MM-dd` (dia-calendário SP). */
  isoDate: string;
  /** Ex.: `seg 20/07`. */
  dayLabel: string;
  events: AgendaEvent[];
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isoDateOf(wall: Date): string {
  return `${wall.getFullYear()}-${pad2(wall.getMonth() + 1)}-${pad2(wall.getDate())}`;
}

function timeLabelOf(wall: Date): string {
  return `${pad2(wall.getHours())}:${pad2(wall.getMinutes())}`;
}

export function groupEventsByDay(
  events: RawCalendarEvent[],
  window: WeekWindow,
): AgendaDay[] {
  // 7 buckets a partir da segunda-feira da janela (wall-clock SP).
  const monday = toZonedTime(window.fromUtc, TIMEZONE);
  const days: AgendaDay[] = [];
  const bucketByIso = new Map<string, AgendaEvent[]>();

  for (let i = 0; i < 7; i++) {
    const wall = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + i,
    );
    const isoDate = isoDateOf(wall);
    const events: AgendaEvent[] = [];
    bucketByIso.set(isoDate, events);
    days.push({
      isoDate,
      dayLabel: `${DAY_NAMES[wall.getDay()]} ${pad2(wall.getDate())}/${pad2(wall.getMonth() + 1)}`,
      events,
    });
  }

  for (const event of events) {
    if (event.status === 'cancelled') continue;
    const summary = event.summary?.trim() || '(sem título)';

    if (event.start?.date) {
      // All-day: cobre [start.date, end.date) em dias-calendário.
      const endExclusive = event.end?.date ?? event.start.date;
      for (const day of days) {
        if (day.isoDate >= event.start.date && day.isoDate < endExclusive) {
          bucketByIso.get(day.isoDate)?.push({
            id: event.id,
            summary,
            startLabel: '',
            endLabel: '',
            isAllDay: true,
            sortKey: -1,
          });
        }
      }
      continue;
    }

    if (!event.start?.dateTime) continue;
    const startWall = toZonedTime(new Date(event.start.dateTime), TIMEZONE);
    const endWall = event.end?.dateTime
      ? toZonedTime(new Date(event.end.dateTime), TIMEZONE)
      : null;

    // Bucket pelo dia-calendário SP do INÍCIO (eventos multi-dia com horário
    // são raros; aparecem só no dia em que começam). Exceção: o Google inclui
    // eventos cujo início é ANTES da janela mas o fim cai dentro dela (timeMin
    // é bound exclusivo sobre o fim) — sem clamp esse evento não teria bucket
    // e seria descartado em silêncio, mostrando a segunda como "livre".
    const startIso = isoDateOf(startWall);
    const firstDay = days[0];
    const startsBeforeWindow = firstDay !== undefined && startIso < firstDay.isoDate;
    const bucketIso = startsBeforeWindow ? firstDay!.isoDate : startIso;

    bucketByIso.get(bucketIso)?.push({
      id: event.id,
      summary,
      startLabel: timeLabelOf(startWall),
      endLabel: endWall ? timeLabelOf(endWall) : '',
      isAllDay: false,
      sortKey: startsBeforeWindow ? 0 : startWall.getHours() * 60 + startWall.getMinutes(),
    });
  }

  for (const day of days) {
    day.events.sort((a, b) => a.sortKey - b.sortKey);
  }

  return days;
}
