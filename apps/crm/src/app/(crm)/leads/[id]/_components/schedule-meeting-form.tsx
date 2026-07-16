'use client';

import { useEffect, useState, useTransition } from 'react';
import { scheduleMeetingAction } from '@/server/actions/meetings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import { KbdHint } from '@/components/ui/kbd-hint';
import { RenataWeekAgenda } from '@/app/(crm)/_components/renata-week-agenda';
import type { GoogleSyncStatus } from '@/server/actions/meetings';

// Feedback honesto: a reunião SEMPRE grava no CRM; o que varia é o evento Google.
const GOOGLE_SYNC_MESSAGES: Record<GoogleSyncStatus, string> = {
  created: 'reunião agendada — convite enviado ao lead',
  created_no_invite: 'reunião agendada — lead sem email, convite não enviado',
  updated: 'reunião agendada',
  deleted: 'reunião agendada',
  skipped_not_connected: 'reunião agendada — google não conectado, evento não criado',
  failed: 'reunião agendada — mas o evento google falhou',
};

export function ScheduleMeetingForm({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [link, setLink] = useState('');
  const [isPending, startTransition] = useTransition();
  const feedback = useActionFeedback();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'M' || !e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return;
      e.preventDefault();
      setOpen(true);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    feedback.pending();
    startTransition(async () => {
      const result = await scheduleMeetingAction({
        leadId,
        scheduledAt,
        link: link || undefined,
      });
      if (result.ok) {
        const sync = result.data?.googleSync ?? 'failed';
        const message = GOOGLE_SYNC_MESSAGES[sync];
        // 'created' é o caminho feliz (success, auto-dismiss). Qualquer outro
        // resultado é um aviso honesto que precisa sobreviver ao form fechar
        // — 'error' não tem auto-dismiss.
        if (sync === 'created') feedback.success(message);
        else feedback.error(message);
        setOpen(false);
        setScheduledAt('');
        setLink('');
      } else {
        feedback.error(result.error);
      }
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 text-btn text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          <span>+ agendar reunião</span>
          <KbdHint keys={['shift', 'm']} />
        </button>
        {/* Sobrevive ao fechamento do form — senão o aviso de sync com o
            google (ex.: "mas o evento google falhou") nunca chega a pintar. */}
        <ActionFeedback state={feedback.state} pendingLabel="agendando..." />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 self-start border border-line bg-canvas p-4"
      >
        <div className="space-y-2">
          <Label htmlFor="scheduled-at">Data e hora (horário SP)</Label>
          <Input
            id="scheduled-at"
            type="datetime-local"
            required
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meeting-link">Link (opcional)</Label>
          <Input
            id="meeting-link"
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://meet.google.com/..."
          />
          <p className="text-micro text-ink-muted">
            vazio = link do meet gerado automaticamente com o evento google
          </p>
        </div>
        <ActionFeedback state={feedback.state} pendingLabel="agendando..." />
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={isPending}
            variant="solid"
            size="sm"
          >
            {isPending ? 'agendando...' : 'agendar'}
          </Button>
          <Button
            type="button"
            onClick={() => setOpen(false)}
            variant="ghost"
          >
            cancelar
          </Button>
        </div>
      </form>
      <RenataWeekAgenda />
    </div>
  );
}
