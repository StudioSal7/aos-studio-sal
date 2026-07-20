'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import {
  analyzeSdrFromChatAction,
  listEvolutionChatsAction,
  type EvolutionChatItem,
} from '@/server/actions/commercial';

function formatLastMessage(epochSeconds: number | null): string {
  if (!epochSeconds) return '';
  return new Date(epochSeconds * 1000).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SdrChatList() {
  const router = useRouter();
  const [chats, setChats] = useState<EvolutionChatItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [analyzingJid, setAnalyzingJid] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const feedback = useActionFeedback();

  async function loadChats() {
    setLoading(true);
    setListError(null);
    const result = await listEvolutionChatsAction();
    setLoading(false);
    if (result.ok) {
      setChats(result.data ?? []);
    } else {
      setListError(result.error);
    }
  }

  useEffect(() => {
    void loadChats();
  }, []);

  function handleAnalyze(chat: EvolutionChatItem) {
    setAnalyzingJid(chat.remoteJid);
    feedback.pending();
    startTransition(async () => {
      const result = await analyzeSdrFromChatAction({
        remoteJid: chat.remoteJid,
        displayName: chat.displayName ?? undefined,
        phoneDigits: chat.phoneDigits,
      });
      setAnalyzingJid(null);
      if (result.ok) {
        feedback.success('análise pronta...');
        router.push(`/analise/sdr/${result.data?.id}` as Route<string>);
      } else {
        feedback.error(result.error);
      }
    });
  }

  const filtered = (chats ?? []).filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (c.displayName?.toLowerCase().includes(q) ?? false) ||
      (c.leadName?.toLowerCase().includes(q) ?? false) ||
      c.phoneDigits.includes(q.replace(/\D/g, ''))
    );
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="filtrar por nome ou número..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={() => void loadChats()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
        {chats && (
          <span className="text-micro text-ink-muted normal-case tracking-normal">
            {filtered.length} de {chats.length} conversas
          </span>
        )}
      </div>

      <ActionFeedback state={feedback.state} pendingLabel="puxando e analisando (até 60s)..." />

      {listError && (
        <p className="text-micro text-clay normal-case tracking-normal">{listError}</p>
      )}

      {loading && !chats && (
        <p className="py-8 text-center text-micro text-ink-muted">carregando conversas...</p>
      )}

      {chats && filtered.length === 0 && (
        <p className="py-8 text-center text-micro text-ink-muted">nenhuma conversa encontrada.</p>
      )}

      <div className="max-h-[28rem] divide-y divide-line overflow-y-auto">
        {filtered.map((chat) => (
          <div key={chat.remoteJid} className="flex items-center gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-btn text-ink normal-case tracking-normal">
                {chat.displayName || chat.leadName || chat.phoneDigits || chat.remoteJid}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-micro text-ink-muted normal-case tracking-normal">
                {chat.phoneDigits && <span>+{chat.phoneDigits}</span>}
                {chat.lastMessageAt && <span>· {formatLastMessage(chat.lastMessageAt)}</span>}
                {chat.leadId && <Badge variant="neutral">lead</Badge>}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAnalyze(chat)}
              disabled={isPending}
            >
              {analyzingJid === chat.remoteJid ? 'analisando...' : 'analisar'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
