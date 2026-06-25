'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@repo/ui';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import { endSessionAction, sendTurnAction, type TurnMessage } from '@/server/actions/treino';

export function Chat({
  sessionId,
  initialMessages,
  status,
}: {
  sessionId: string;
  initialMessages: TurnMessage[];
  status: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<TurnMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isSending, startSend] = useTransition();
  const [isEnding, startEnd] = useTransition();
  const feedback = useActionFeedback();
  const bottomRef = useRef<HTMLDivElement>(null);

  const isOpen = status === 'em_andamento';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  function handleSend() {
    const content = input.trim();
    if (!content || isSending) return;
    feedback.reset();
    startSend(async () => {
      const result = await sendTurnAction({ sessionId, content });
      if (result.ok && result.data) {
        setMessages((prev) => [...prev, ...result.data!.messages]);
        setInput('');
      } else if (!result.ok) {
        feedback.error(result.error);
      }
    });
  }

  function handleEnd() {
    feedback.pending();
    startEnd(async () => {
      const result = await endSessionAction({ sessionId });
      if (result.ok) {
        feedback.success('avaliando...');
        router.refresh();
      } else {
        feedback.error(result.error);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter quebra linha.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-1">
        {messages.length === 0 && (
          <p className="py-8 text-center text-micro text-ink-muted normal-case tracking-normal">
            Comece a conversa — você é a closer. Faça a primeira pergunta ao lead.
          </p>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} content={m.content} />
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="max-w-[75%] border border-line bg-paper px-4 py-2 text-body text-ink-muted">
              o lead está pensando…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {isOpen ? (
        <div className="space-y-3 border-t border-line pt-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="sua fala como closer… (Enter envia, Shift+Enter quebra linha)"
            disabled={isSending || isEnding}
            className="resize-y"
          />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button onClick={handleSend} disabled={isSending || isEnding || !input.trim()} variant="solid" size="sm">
                {isSending ? 'enviando…' : 'enviar'}
              </Button>
              <ActionFeedback state={feedback.state} pendingLabel="avaliando…" />
            </div>
            <Button
              onClick={handleEnd}
              disabled={isEnding || isSending || messages.length < 2}
              variant="outline"
              size="sm"
            >
              {isEnding ? 'avaliando…' : 'encerrar e avaliar'}
            </Button>
          </div>
          {isEnding && (
            <p className="text-micro text-ink-muted normal-case tracking-normal">
              Isso pode levar até 60 segundos — a sessão passa pela régua SPIN no gpt-4o.
            </p>
          )}
        </div>
      ) : (
        <p className="border-t border-line pt-4 text-micro text-ink-muted normal-case tracking-normal">
          Sessão encerrada — veja o feedback abaixo.
        </p>
      )}
    </div>
  );
}

function Bubble({ role, content }: { role: string; content: string }) {
  if (role === 'system') {
    return (
      <p className="py-2 text-center text-micro text-ink-muted normal-case tracking-normal">
        {content}
      </p>
    );
  }
  const isCloser = role === 'closer';
  return (
    <div className={cn('flex', isCloser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] whitespace-pre-wrap px-4 py-2 text-body',
          isCloser ? 'bg-ink text-paper' : 'border border-line bg-paper text-ink',
        )}
      >
        <span className="mb-0.5 block text-micro normal-case tracking-normal opacity-60">
          {isCloser ? 'você (closer)' : 'lead'}
        </span>
        {content}
      </div>
    </div>
  );
}
