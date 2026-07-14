/**
 * Resolve um recorte de período em `{ from, to }` (instantes reais, timestamptz).
 *
 * `7d`/`30d` são janelas rolantes (últimos N dias até agora — `to: null`).
 * `this_month`/`last_month` são meses de calendário em America/Sao_Paulo
 * (`to` exclusivo — início do mês seguinte).
 * `all` não tem limite.
 */

import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export type DateRangeOption = '7d' | '30d' | 'this_month' | 'last_month' | 'all';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export const DATE_RANGE_OPTIONS: Array<{ value: DateRangeOption; label: string }> = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'this_month', label: 'este mês' },
  { value: 'last_month', label: 'mês passado' },
  { value: 'all', label: 'todo o período' },
];

export const DEFAULT_DATE_RANGE: DateRangeOption = '7d';

const TIMEZONE = 'America/Sao_Paulo';

export function isDateRangeOption(value: string | null | undefined): value is DateRangeOption {
  return (
    value === '7d' ||
    value === '30d' ||
    value === 'this_month' ||
    value === 'last_month' ||
    value === 'all'
  );
}

export function labelForDateRange(option: DateRangeOption): string {
  return DATE_RANGE_OPTIONS.find((o) => o.value === option)?.label ?? option;
}

export function resolveDateRange(option: DateRangeOption, now: Date = new Date()): DateRange {
  if (option === 'all') return { from: null, to: null };

  if (option === '7d' || option === '30d') {
    const days = option === '7d' ? 7 : 30;
    return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), to: null };
  }

  // this_month / last_month — mês de calendário em America/Sao_Paulo.
  const zoned = toZonedTime(now, TIMEZONE);
  const year = zoned.getFullYear();
  const month = zoned.getMonth(); // 0-based
  const targetMonth = option === 'this_month' ? month : month - 1;

  // new Date(year, mês<0, ...) normaliza sozinho pro ano anterior — vale pra virada de ano.
  const startWallClock = new Date(year, targetMonth, 1, 0, 0, 0, 0);
  const endWallClock = new Date(year, targetMonth + 1, 1, 0, 0, 0, 0);

  return {
    from: fromZonedTime(startWallClock, TIMEZONE),
    to: fromZonedTime(endWallClock, TIMEZONE),
  };
}
