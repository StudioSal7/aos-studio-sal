'use client';

import { useState, useTransition } from 'react';
import { updateLeadFieldsAction } from '@/server/actions/leads';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';

export function LeadNotesForm({
  leadId,
  initialNotes,
}: {
  leadId: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [isPending, startTransition] = useTransition();
  const feedback = useActionFeedback();

  function handleSave() {
    feedback.pending();
    startTransition(async () => {
      const result = await updateLeadFieldsAction({ leadId, notes });
      if (result.ok) feedback.success('salvo');
      else feedback.error(result.error);
    });
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-micro text-ink-muted">Notas</h2>
        <ActionFeedback state={feedback.state} pendingLabel="salvando..." />
      </div>
      <Textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          if (feedback.state.kind !== 'idle') feedback.reset();
        }}
        rows={5}
        placeholder="Contexto sobre o lead, histórico de conversas, observações..."
        className="resize-none"
      />
      <Button
        onClick={handleSave}
        disabled={isPending}
        variant="solid"
        size="sm"
        className="mt-3"
      >
        {isPending ? 'salvando...' : 'salvar notas'}
      </Button>
    </Card>
  );
}
