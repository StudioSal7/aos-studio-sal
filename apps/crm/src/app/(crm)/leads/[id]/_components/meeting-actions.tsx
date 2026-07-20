'use client';

/**
 * Ações inline numa reunião agendada: reagendar e cancelar.
 * Propagam pro Google via actions (PATCH/DELETE no evento vinculado) —
 * o feedback reflete o resultado real da propagação.
 */

import { useState, useTransition } from 'react';
import {
  cancelMeetingAction,
  rescheduleMeetingAction,
  type GoogleSyncStatus,
} from '@/server/actions/meetings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';

const RESCHEDULE_MESSAGES: Record<GoogleSyncStatus, string> = {
  created: 'reunião reagendada',
  created_no_invite: 'reunião reagendada',
  updated: 'reunião reagendada — evento google atualizado',
  deleted: 'reunião reagendada',
  skipped_not_connected: 'reunião reagendada — sem evento google vinculado',
  failed: 'horário gravado — mas o evento google não foi atualizado',
};

const CANCEL_MESSAGES: Record<GoogleSyncStatus, string> = {
  created: 'reunião cancelada',
  created_no_invite: 'reunião cancelada',
  updated: 'reunião cancelada',
  deleted: 'reunião cancelada — evento google removido',
  skipped_not_connected: 'reunião cancelada — sem evento google vinculado',
  failed: 'reunião cancelada — mas o evento google não foi removido',
};

export function MeetingActions({
  meetingId,
  leadId,
  status,
}: {
  meetingId: string;
  leadId: string;
  /**
   * Sempre renderizado (não gated pelo caller) — a instância precisa
   * sobreviver à revalidação que muda o status pra 'cancelada'/'reagendada',
   * senão o feedback de falha do Google desmonta antes de ser lido.
   */
  status: 'agendada' | 'realizada' | 'nao_realizada' | 'reagendada' | 'cancelada';
}) {
  const [mode, setMode] = useState<'idle' | 'reschedule' | 'confirm-cancel'>('idle');
  const [newScheduledAt, setNewScheduledAt] = useState('');
  const [link, setLink] = useState('');
  const [isPending, startTransition] = useTransition();
  const feedback = useActionFeedback();

  function handleReschedule(e: React.FormEvent) {
    e.preventDefault();
    feedback.pending();
    startTransition(async () => {
      const result = await rescheduleMeetingAction({
        originalMeetingId: meetingId,
        leadId,
        newScheduledAt,
        link: link || undefined,
      });
      if (result.ok) {
        const sync = result.data?.googleSync ?? 'failed';
        const message = RESCHEDULE_MESSAGES[sync];
        // 'error' não tem auto-dismiss — a única forma de sobreviver à
        // revalidação que já trocou o status desta reunião.
        if (sync === 'failed') feedback.error(message);
        else feedback.success(message);
        setMode('idle');
        setNewScheduledAt('');
        setLink('');
      } else {
        feedback.error(result.error);
      }
    });
  }

  function handleCancel() {
    feedback.pending();
    startTransition(async () => {
      const result = await cancelMeetingAction({ meetingId, leadId });
      if (result.ok) {
        const sync = result.data?.googleSync ?? 'failed';
        const message = CANCEL_MESSAGES[sync];
        if (sync === 'failed') feedback.error(message);
        else feedback.success(message);
        setMode('idle');
      } else {
        feedback.error(result.error);
      }
    });
  }

  if (mode === 'reschedule') {
    return (
      <form onSubmit={handleReschedule} className="space-y-3 border border-line bg-canvas p-3">
        <div className="space-y-2">
          <Label htmlFor={`reschedule-at-${meetingId}`}>Nova data e hora (horário SP)</Label>
          <Input
            id={`reschedule-at-${meetingId}`}
            type="datetime-local"
            required
            value={newScheduledAt}
            onChange={(e) => setNewScheduledAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`reschedule-link-${meetingId}`}>Link (opcional — vazio mantém o atual)</Label>
          <Input
            id={`reschedule-link-${meetingId}`}
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://meet.google.com/..."
          />
        </div>
        <ActionFeedback state={feedback.state} pendingLabel="reagendando..." />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending} variant="solid" size="sm">
            {isPending ? 'reagendando...' : 'reagendar'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMode('idle')}>
            voltar
          </Button>
        </div>
      </form>
    );
  }

  if (mode === 'confirm-cancel') {
    return (
      <div className="space-y-2 border border-line bg-canvas p-3">
        <p className="text-body text-ink">
          cancelar esta reunião? o evento na google agenda também será removido.
        </p>
        <ActionFeedback state={feedback.state} pendingLabel="cancelando..." />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="solid"
            size="sm"
            disabled={isPending}
            onClick={handleCancel}
          >
            {isPending ? 'cancelando...' : 'confirmar cancelamento'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMode('idle')}>
            voltar
          </Button>
        </div>
      </div>
    );
  }

  // Sempre montado (ver comentário na prop `status`) — os gatilhos só
  // aparecem enquanto a reunião está agendada; o feedback (ex.: erro de
  // sync com o Google) sobrevive à mudança de status porque a instância
  // não desmonta.
  return (
    <div className="flex items-center gap-4">
      {status === 'agendada' && (
        <>
          <button
            type="button"
            onClick={() => setMode('reschedule')}
            className="text-btn text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            reagendar
          </button>
          <button
            type="button"
            onClick={() => setMode('confirm-cancel')}
            className="text-btn text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            cancelar reunião
          </button>
        </>
      )}
      <ActionFeedback state={feedback.state} pendingLabel="..." />
    </div>
  );
}
