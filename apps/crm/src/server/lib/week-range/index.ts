/**
 * Janelas de semana de calendário (segunda→domingo) em America/Sao_Paulo.
 *
 * Usado pela visão "evolução semanal" do dashboard: sempre as N semanas mais
 * recentes, a corrente inclusa (parcial). `to` é exclusivo (início da segunda
 * seguinte), igual ao recorte de mês em `date-range`. Brasil não observa
 * horário de verão desde 2019 → America/Sao_Paulo = UTC-3 fixo, sem
 * ambiguidade na meia-noite.
 */

import { fromZonedTime, toZonedTime } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

export interface WeekRange {
  /** Instante real (timestamptz) do início da semana — segunda 00:00 SP. */
  from: Date;
  /** Instante real exclusivo — segunda 00:00 SP da semana seguinte. */
  to: Date;
  /** Rótulo `dd/MM–dd/MM` (segunda→domingo). */
  label: string;
  /** true na semana que contém `now` (parcial). */
  isCurrent: boolean;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * As `n` semanas de calendário mais recentes (mais recente primeiro).
 * Cada `WeekRange` cobre segunda 00:00 (inclusivo) → segunda 00:00 seguinte
 * (exclusivo), em America/Sao_Paulo.
 */
export function lastNWeeks(n: number, now: Date = new Date()): WeekRange[] {
  const zoned = toZonedTime(now, TIMEZONE);
  const year = zoned.getFullYear();
  const month = zoned.getMonth(); // 0-based
  const date = zoned.getDate();
  const dow = zoned.getDay(); // 0=domingo … 6=sábado
  const daysFromMonday = (dow + 6) % 7; // segunda = 0

  const weeks: WeekRange[] = [];
  for (let i = 0; i < n; i++) {
    // Segunda-feira (wall-clock SP) da semana i — i=0 é a semana corrente.
    // new Date(...) normaliza sozinho viradas de mês/ano.
    const startWall = new Date(year, month, date - daysFromMonday - i * 7, 0, 0, 0, 0);
    const endWall = new Date(year, month, date - daysFromMonday - i * 7 + 7, 0, 0, 0, 0);
    const sundayWall = new Date(year, month, date - daysFromMonday - i * 7 + 6, 0, 0, 0, 0);

    weeks.push({
      from: fromZonedTime(startWall, TIMEZONE),
      to: fromZonedTime(endWall, TIMEZONE),
      label: `${pad2(startWall.getDate())}/${pad2(startWall.getMonth() + 1)}–${pad2(
        sundayWall.getDate(),
      )}/${pad2(sundayWall.getMonth() + 1)}`,
      isCurrent: i === 0,
    });
  }
  return weeks;
}
