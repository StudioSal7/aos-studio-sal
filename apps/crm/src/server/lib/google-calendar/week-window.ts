/**
 * Janela de semana de calendário (segunda→domingo, America/Sao_Paulo) com
 * offset PRA FRENTE — a agenda navega da semana atual em diante.
 *
 * Mesma matemática do `week-range` (que só anda pra trás e não é tocado
 * para evitar conflito com frentes paralelas). Brasil não observa horário
 * de verão desde 2019 → SP = UTC-3 fixo.
 */

import { fromZonedTime, toZonedTime } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

/** Teto de navegação — 8 semanas à frente (compartilhado server+client). */
export const MAX_WEEK_OFFSET = 8;

export interface WeekWindow {
  /** Instante real do início — segunda 00:00 SP (inclusivo). */
  fromUtc: Date;
  /** Instante real exclusivo — segunda 00:00 SP da semana seguinte. */
  toUtc: Date;
  /** Rótulo `dd/MM–dd/MM` (segunda→domingo). */
  label: string;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** offset 0 = semana corrente; 1 = próxima; etc. */
export function weekWindowAtOffset(offset: number, now: Date = new Date()): WeekWindow {
  const zoned = toZonedTime(now, TIMEZONE);
  const year = zoned.getFullYear();
  const month = zoned.getMonth();
  const date = zoned.getDate();
  const daysFromMonday = (zoned.getDay() + 6) % 7; // segunda = 0

  const startWall = new Date(year, month, date - daysFromMonday + offset * 7, 0, 0, 0, 0);
  const endWall = new Date(year, month, date - daysFromMonday + offset * 7 + 7, 0, 0, 0, 0);
  const sundayWall = new Date(year, month, date - daysFromMonday + offset * 7 + 6, 0, 0, 0, 0);

  return {
    fromUtc: fromZonedTime(startWall, TIMEZONE),
    toUtc: fromZonedTime(endWall, TIMEZONE),
    label: `${pad2(startWall.getDate())}/${pad2(startWall.getMonth() + 1)}–${pad2(
      sundayWall.getDate(),
    )}/${pad2(sundayWall.getMonth() + 1)}`,
  };
}
