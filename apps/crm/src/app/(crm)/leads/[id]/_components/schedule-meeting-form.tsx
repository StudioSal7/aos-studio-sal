'use client';

import { useEffect, useState, useTransition } from 'react';
import { scheduleMeetingAction } from '@/server/actions/meetings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import { KbdHint } from '@/components/ui/kbd-hint';

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
        feedback.success('reunião agendada');
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
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-btn text-ink-muted underline-offset-2 hover:text-ink hover:underline"
      >
        <span>+ agendar reunião</span>
        <KbdHint keys={['shift', 'm']} />
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 border border-line bg-canvas p-4"
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
  );
}
