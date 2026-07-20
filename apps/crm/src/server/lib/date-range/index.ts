/**
 * Resolve um recorte de período em `{ from, to }` (instantes reais, timestamptz).
 *
 * Todos os presets são períodos FECHADOS de calendário em America/Sao_Paulo
 * (`to` exclusivo) — sem janela rolante "últimos N dias". `this_week`/
 * `last_4_weeks` incluem a semana corrente (parcial, rotulada "em curso" na
 * UI) — fechado aqui significa "calendário", não "semana já concluída".
 * `custom` é um intervalo de datas civis informado pelo usuário. `all` não
 * tem limite.
 */

import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { lastNWeeks } from '@/server/lib/week-range/index';

export type DateRangeOption =
  | 'this_week'
  | 'last_week'
  | 'last_4_weeks'
  | 'this_month'
  | 'last_month'
  | 'custom'
  | 'all';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export const DATE_RANGE_OPTIONS: Array<{ value: Exclude<DateRangeOption, 'custom'>; label: string }> = [
  { value: 'this_week', label: 'esta semana (em curso)' },
  { value: 'last_week', label: 'semana passada' },
  { value: 'last_4_weeks', label: 'últimas 4 semanas' },
  { value: 'this_month', label: 'este mês' },
  { value: 'last_month', label: 'mês passado' },
  { value: 'all', label: 'todo o período' },
];

export const DEFAULT_DATE_RANGE: Exclude<DateRangeOption, 'custom'> = 'this_week';

const TIMEZONE = 'America/Sao_Paulo';

export function isDateRangeOption(value: string | null | undefined): value is DateRangeOption {
  return (
    value === 'this_week' ||
    value === 'last_week' ||
    value === 'last_4_weeks' ||
    value === 'this_month' ||
    value === 'last_month' ||
    value === 'custom' ||
    value === 'all'
  );
}

export function labelForDateRange(option: DateRangeOption): string {
  return DATE_RANGE_OPTIONS.find((o) => o.value === option)?.label ?? option;
}

export function resolveDateRange(
  option: Exclude<DateRangeOption, 'custom'>,
  now: Date = new Date(),
): DateRange {
  if (option === 'all') return { from: null, to: null };

  if (option === 'this_week') {
    const [current] = lastNWeeks(1, now);
    return { from: current!.from, to: current!.to };
  }

  if (option === 'last_week') {
    const weeks = lastNWeeks(2, now);
    const previous = weeks[1]!;
    return { from: previous.from, to: previous.to };
  }

  if (option === 'last_4_weeks') {
    const weeks = lastNWeeks(4, now); // [corrente, ..., 3 semanas atrás]
    return { from: weeks[3]!.from, to: weeks[0]!.to };
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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Confere que `y-m-d` é uma data civil real (rejeita ex. 2026-02-30). */
function isRealCalendarDate(y: number, m: number, d: number): boolean {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * Intervalo custom a partir de datas civis `YYYY-MM-DD` em America/Sao_Paulo.
 * `to` é inclusivo na entrada (o usuário escolhe "até 10/07") — convertido pro
 * instante exclusivo (dia seguinte 00:00 SP) internamente. Qualquer entrada
 * ausente, malformada, com data inexistente ou `from > to` → null.
 */
export function resolveCustomRange(
  fromStr: string | undefined,
  toStr: string | undefined,
): DateRange | null {
  if (!fromStr || !toStr) return null;
  if (!ISO_DATE_RE.test(fromStr) || !ISO_DATE_RE.test(toStr)) return null;

  const [fy, fm, fd] = fromStr.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = toStr.split('-').map(Number) as [number, number, number];
  if (!isRealCalendarDate(fy, fm, fd) || !isRealCalendarDate(ty, tm, td)) return null;
  if (fromStr > toStr) return null;

  const from = fromZonedTime(new Date(fy, fm - 1, fd, 0, 0, 0, 0), TIMEZONE);
  const to = fromZonedTime(new Date(ty, tm - 1, td + 1, 0, 0, 0, 0), TIMEZONE); // dia seguinte a `to`

  return { from, to };
}

function formatCivilDateBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y?.slice(-2)}`;
}

export interface ResolvedPeriod {
  option: DateRangeOption;
  range: DateRange;
  label: string;
}

/**
 * Entrada crua de searchParams → período resolvido. `range` ausente/inválido
 * (ou `custom` sem `from`/`to` válidos) cai no default (`this_week`).
 */
export function resolveDashboardPeriod(
  params: { range?: string; from?: string; to?: string },
  now: Date = new Date(),
): ResolvedPeriod {
  if (params.range === 'custom') {
    const range = resolveCustomRange(params.from, params.to);
    if (range) {
      return {
        option: 'custom',
        range,
        label: `${formatCivilDateBr(params.from!)}–${formatCivilDateBr(params.to!)}`,
      };
    }
    // custom inválido → cai no default abaixo.
  } else if (isDateRangeOption(params.range) && params.range !== 'custom') {
    return {
      option: params.range,
      range: resolveDateRange(params.range, now),
      label: labelForDateRange(params.range),
    };
  }

  return {
    option: DEFAULT_DATE_RANGE,
    range: resolveDateRange(DEFAULT_DATE_RANGE, now),
    label: labelForDateRange(DEFAULT_DATE_RANGE),
  };
}
