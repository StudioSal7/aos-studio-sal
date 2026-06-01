'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import { analyzeSdrFromLeadAction } from '@/server/actions/commercial';

export function SdrAnalysisButton({
  leadId,
  whatsappE164,
}: {
  leadId: string;
  whatsappE164: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const feedback = useActionFeedback();

  const hasWhatsapp = Boolean(whatsappE164);

  function handleClick() {
    feedback.pending();
    startTransition(async () => {
      const result = await analyzeSdrFromLeadAction(leadId);
      if (result.ok) {
        feedback.success('análise pronta...');
        router.push(`/analise/sdr/${result.data?.id}` as Route<string>);
      } else {
        feedback.error(result.error);
      }
    });
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2 text-micro text-ink-muted">
        <MessageSquareText size={16} strokeWidth={1.5} />
        análise sdr (whatsapp)
      </div>
      <p className="text-body text-ink-muted">
        {hasWhatsapp
          ? 'puxa a conversa de WhatsApp deste lead e gera o score do SDR.'
          : 'lead sem WhatsApp cadastrado — não é possível puxar a conversa.'}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={!hasWhatsapp || isPending}
      >
        {isPending ? 'puxando conversa...' : 'analisar whatsapp'}
      </Button>
      <ActionFeedback state={feedback.state} pendingLabel="puxando e analisando (até 60s)..." />
    </Card>
  );
}
