'use client';

/**
 * Agenda semanal da conta Google conectada (Renata), somente leitura.
 * A Ana consulta os horários ocupados e digita o horário no form de
 * agendamento — sem clique em slot, sem sugestão (decisão de escopo v1).
 *
 * Busca lazy via server action (1 chamada Google por semana navegada).
 */

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  getGoogleWeekAgendaAction,
  type WeekAgendaData,
} from '@/server/actions/google-calendar';
// Import direto do módulo puro — nunca o barrel (re-exporta account.ts, que
// puxa @repo/db/client pro bundle do client).
import { MAX_WEEK_OFFSET } from '@/server/lib/google-calendar/week-window';

const NOT_CONNECTED_MESSAGES: Record<string, string> = {
  not_connected: 'agenda google não conectada.',
  invalid_grant: 'conexão com o google expirou — o owner precisa reconectar.',
  google_error: 'não foi possível carregar a agenda google.',
};

export function RenataWeekAgenda() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<WeekAgendaData | null>(null);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let stale = false;
    startTransition(async () => {
      const result = await getGoogleWeekAgendaAction({ weekOffset }).catch(() => null);
      if (stale) return;
      if (result?.ok && result.data) {
        setData(result.data);
        setFailed(false);
      } else {
        setFailed(true);
      }
    });
    return () => {
      stale = true;
    };
  }, [weekOffset, reloadKey]);

  const showSkeleton = isPending || (!data && !failed);

  return (
    <div className="space-y-3 border border-line bg-paper p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-micro text-ink-muted">agenda da renata</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="semana anterior"
            disabled={weekOffset === 0 || isPending}
            onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
            className="px-2 py-1 text-btn text-ink-muted hover:text-ink disabled:opacity-30"
          >
            ‹
          </button>
          <span className="min-w-[110px] text-center font-mono text-micro text-ink-muted tracking-normal">
            {data?.connected ? data.weekLabel : '—'}
          </span>
          <button
            type="button"
            aria-label="próxima semana"
            disabled={weekOffset >= MAX_WEEK_OFFSET || isPending}
            onClick={() => setWeekOffset((o) => Math.min(MAX_WEEK_OFFSET, o + 1))}
            className="px-2 py-1 text-btn text-ink-muted hover:text-ink disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      {showSkeleton ? (
        <div className="space-y-2" aria-busy>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-6 animate-pulse bg-canvas" />
          ))}
        </div>
      ) : failed ? (
        <div className="space-y-2">
          <p className="text-body text-ink-muted">
            {NOT_CONNECTED_MESSAGES.google_error}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="text-btn text-ink-muted underline underline-offset-2 hover:text-ink"
          >
            tentar de novo
          </button>
        </div>
      ) : data && !data.connected ? (
        <div className="space-y-2">
          <p className="text-body text-ink-muted">
            {NOT_CONNECTED_MESSAGES[data.reason]}
          </p>
          {data.reason === 'google_error' ? (
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="text-btn text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              tentar de novo
            </button>
          ) : (
            <Link
              href="/admin"
              className="text-btn text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              ir para o admin
            </Link>
          )}
        </div>
      ) : data?.connected ? (
        <div className="space-y-3">
          {data.days.map((day) => (
            <div key={day.isoDate} className="flex gap-3">
              <span className="w-20 shrink-0 font-mono text-micro text-ink-muted tracking-normal">
                {day.dayLabel}
              </span>
              {day.events.length === 0 ? (
                <span className="text-micro text-ink-muted/60">livre</span>
              ) : (
                <ul className="min-w-0 flex-1 space-y-1">
                  {day.events.map((event, i) => (
                    <li
                      key={`${event.id}-${i}`}
                      className="truncate text-micro text-ink normal-case"
                    >
                      {event.isAllDay ? (
                        <span className="text-ink-muted">dia inteiro</span>
                      ) : (
                        <span className="font-mono text-ink-muted tracking-normal">
                          {event.startLabel}
                          {event.endLabel ? `–${event.endLabel}` : ''}
                        </span>
                      )}{' '}
                      {event.summary}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <p className="text-micro text-ink-muted/60 normal-case">{data.accountEmail}</p>
        </div>
      ) : null}
    </div>
  );
}
