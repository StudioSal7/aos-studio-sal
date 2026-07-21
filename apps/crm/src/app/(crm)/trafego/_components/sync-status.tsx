import type { MetaSyncRun } from '@repo/db/schema';
import { shortDay } from './format';

// Empty state tri-estado (herança do royal-eagle): "nunca sincronizou" ≠
// "sincronizou sem linhas" ≠ "gastou zero de verdade" — três coisas diferentes
// que um dashboard honesto não pode misturar.

function fmtDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SyncStatus({
  lastRun,
  hasRowsInWindow,
}: {
  lastRun: MetaSyncRun | null;
  hasRowsInWindow: boolean;
}) {
  if (!lastRun) {
    return (
      <div className="border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-[12px] normal-case tracking-normal text-amber-800">
          nenhum sync executado ainda — configure <code>META_ACCESS_TOKEN</code> +{' '}
          <code>META_AD_ACCOUNT_ID</code> e rode{' '}
          <code>pnpm --filter crm meta-backfill -- --since=2026-02-01</code>. O cron diário (06:00)
          assume depois.
        </p>
      </div>
    );
  }

  if (lastRun.status === 'error') {
    return (
      <div className="border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-[12px] normal-case tracking-normal text-red-800">
          último sync FALHOU em {fmtDateTime(lastRun.startedAt)} ({lastRun.trigger}) —{' '}
          {lastRun.error ?? 'erro desconhecido'}
        </p>
      </div>
    );
  }

  // 'running' preso: se o processo morreu no meio (maxDuration, deploy, OOM) a
  // linha nunca fecha em ok/error — sem este branch pareceria sync saudável.
  // maxDuration do cron é 300s; >10min parado é sinal seguro de travamento.
  const STUCK_THRESHOLD_MS = 10 * 60 * 1000;
  if (lastRun.status === 'running' && Date.now() - lastRun.startedAt.getTime() > STUCK_THRESHOLD_MS) {
    return (
      <div className="border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-[12px] normal-case tracking-normal text-amber-800">
          sync iniciado em {fmtDateTime(lastRun.startedAt)} ({lastRun.trigger}) parece travado —
          nunca fechou em ok/erro. Verificar logs da Vercel.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border border-line bg-paper px-4 py-3">
      <span className={`h-2 w-2 shrink-0 rounded-full ${hasRowsInWindow ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      <p className="text-[12px] normal-case tracking-normal text-ink-muted">
        último sync {fmtDateTime(lastRun.startedAt)} · janela {shortDay(lastRun.sinceDate)}–
        {shortDay(lastRun.untilDate)} · {lastRun.rowsUpserted} linhas
        {!hasRowsInWindow && ' — sem entrega na janela de decisão (dado sincronizado, zero atividade)'}
      </p>
    </div>
  );
}
