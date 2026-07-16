'use client';

import { useState, useTransition } from 'react';
import { disconnectGoogleAccountAction } from '@/server/actions/google-calendar';
import { Button } from '@/components/ui/button';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';

export interface GoogleAccountView {
  id: string;
  googleEmail: string;
  isActive: boolean;
  lastSyncError: string | null;
}

const BANNER_MESSAGES: Record<string, { text: string; isError: boolean }> = {
  connected: { text: 'agenda google conectada.', isError: false },
  denied: { text: 'conexão cancelada na tela do google.', isError: true },
  state: { text: 'sessão de conexão expirou — tente de novo.', isError: true },
  forbidden: { text: 'só o owner pode conectar a agenda.', isError: true },
  exchange: { text: 'falha ao trocar credenciais com o google — tente de novo.', isError: true },
};

export function GoogleAgendaSection({
  accounts,
  banner,
}: {
  accounts: GoogleAccountView[];
  banner: string | null;
}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const feedback = useActionFeedback();

  async function handleConnect() {
    setIsConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch('/api/google/oauth/start', { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setConnectError('não foi possível iniciar a conexão — tente de novo.');
      setIsConnecting(false);
    }
  }

  function handleDisconnect(accountId: string) {
    feedback.pending();
    startTransition(async () => {
      const result = await disconnectGoogleAccountAction({ accountId });
      if (result.ok) {
        feedback.success('conta desconectada');
      } else {
        feedback.error(result.error);
      }
    });
  }

  const bannerInfo = banner ? BANNER_MESSAGES[banner] : undefined;
  const active = accounts.find((a) => a.isActive);
  const broken = accounts.find((a) => !a.isActive && a.lastSyncError === 'invalid_grant');

  return (
    <div className="space-y-4">
      {bannerInfo && (
        <p
          className={`border px-4 py-3 text-body ${
            bannerInfo.isError
              ? 'border-signal-hot/40 bg-signal-hot/5 text-signal-hot'
              : 'border-leaf/40 bg-leaf/5 text-leaf'
          }`}
        >
          {bannerInfo.text}
        </p>
      )}

      <div className="border border-line bg-paper p-6">
        {active ? (
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-block size-2 rounded-full bg-leaf" aria-hidden />
            <div className="flex-1 min-w-[240px]">
              <p className="text-body text-ink normal-case">{active.googleEmail}</p>
              <p className="text-micro text-ink-muted">
                agenda conectada — reuniões do CRM criam eventos nesta conta
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => handleDisconnect(active.id)}
            >
              {isPending ? 'desconectando...' : 'desconectar'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[240px]">
              {broken ? (
                <>
                  <p className="text-body text-ink normal-case">{broken.googleEmail}</p>
                  <p className="text-micro text-signal-hot">
                    conexão expirada ou revogada — reconecte para voltar a criar eventos
                  </p>
                </>
              ) : (
                <p className="text-body text-ink-muted">
                  nenhuma conta google conectada. conecte a agenda da renata para o CRM
                  exibir a semana e criar os eventos das reuniões.
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="solid"
              size="sm"
              disabled={isConnecting}
              onClick={handleConnect}
            >
              {isConnecting
                ? 'redirecionando...'
                : broken
                  ? 'reconectar'
                  : 'conectar google agenda'}
            </Button>
          </div>
        )}
        {connectError && <p className="mt-3 text-micro text-signal-hot">{connectError}</p>}
        <ActionFeedback state={feedback.state} pendingLabel="desconectando..." className="mt-3" />
      </div>
    </div>
  );
}
