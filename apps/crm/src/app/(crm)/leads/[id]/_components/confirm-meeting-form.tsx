'use client';

import { useState, useTransition } from 'react';
import { completeMeetingAction } from '@/server/actions/meetings';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';

export function ConfirmMeetingForm({
  meetingId,
  leadId,
}: {
  meetingId: string;
  leadId: string;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const feedback = useActionFeedback();

  function confirm(status: 'realizada' | 'nao_realizada') {
    feedback.pending();
    startTransition(async () => {
      const result = await completeMeetingAction({
        meetingId,
        leadId,
        status,
        notesPostCall: notes || undefined,
      });
      if (result.ok) {
        feedback.success(status === 'realizada' ? 'reunião confirmada' : 'marcada como não realizada');
        setOpen(false);
      } else {
        feedback.error(result.error);
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="text-btn text-wood underline-offset-2 hover:underline"
        >
          confirmar realização
        </button>
        <ActionFeedback state={feedback.state} pendingLabel="confirmando..." />
      </div>
    );
  }

  return (
    <div className="space-y-3 border border-line border-l-2 border-l-wood bg-canvas p-4">
      <p className="text-micro text-wood">A reunião aconteceu?</p>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas pós-call (opcional)"
        rows={3}
      />
      <ActionFeedback state={feedback.state} pendingLabel="confirmando..." />
      <div className="flex items-center gap-3">
        <Button
          onClick={() => confirm('realizada')}
          disabled={isPending}
          variant="solid"
          size="sm"
        >
          sim, aconteceu
        </Button>
        <Button
          onClick={() => confirm('nao_realizada')}
          disabled={isPending}
          variant="outline"
          size="sm"
        >
          não aconteceu
        </Button>
        <Button
          type="button"
          onClick={() => setOpen(false)}
          variant="ghost"
        >
          cancelar
        </Button>
      </div>
    </div>
  );
}
