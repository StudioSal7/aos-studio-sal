'use client';

import { useTransition, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import { analyzeCloserAction, searchLeadsAction } from '@/server/actions/commercial';

type LeadOption = { id: string; name: string | null; nickname: string | null };

export function CloserAnalysisForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const feedback = useActionFeedback();

  const [title, setTitle] = useState('');
  const [callDate, setCallDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [durationMinutes, setDurationMinutes] = useState('');
  const [transcript, setTranscript] = useState('');

  // Seletor opcional de lead
  const [leadQuery, setLeadQuery] = useState('');
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [searching, setSearching] = useState(false);

  const searchLeads = useCallback(async (q: string) => {
    setLeadQuery(q);
    if (q.trim().length < 2) {
      setLeadOptions([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchLeadsAction(q);
      setLeadOptions(results);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleSubmit() {
    feedback.pending();
    startTransition(async () => {
      const result = await analyzeCloserAction({
        title: title.trim() || transcript.slice(0, 60).trim(),
        callDate,
        transcript,
        durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : undefined,
        leadId: selectedLead?.id,
      });

      if (result.ok) {
        feedback.success('analisando...');
        router.push(`/analise/closer/${result.data?.id}` as Route<string>);
      } else {
        feedback.error(result.error);
      }
    });
  }

  const charCount = transcript.length;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Card className="space-y-5 p-6">
        {/* Título */}
        <div className="space-y-1.5">
          <Label htmlFor="title">título</Label>
          <Input
            id="title"
            placeholder="ex: Call com Fernanda Bretas"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Data + Duração */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="callDate">data da call</Label>
            <Input
              id="callDate"
              type="date"
              value={callDate}
              onChange={(e) => setCallDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="duration">duração (min)</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              max={300}
              placeholder="opcional"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </div>
        </div>

        {/* Seletor de lead (opcional) */}
        <div className="space-y-1.5">
          <Label htmlFor="leadSearch">lead vinculado (opcional)</Label>
          {selectedLead ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 rounded border border-line bg-canvas px-3 py-2 text-micro text-ink">
                {selectedLead.name ?? selectedLead.nickname ?? selectedLead.id}
              </span>
              <button
                type="button"
                onClick={() => { setSelectedLead(null); setLeadQuery(''); setLeadOptions([]); }}
                className="text-micro text-ink-muted hover:text-ink"
              >
                remover
              </button>
            </div>
          ) : (
            <div className="relative">
              <Input
                id="leadSearch"
                placeholder="buscar pelo nome ou apelido"
                value={leadQuery}
                onChange={(e) => searchLeads(e.target.value)}
                autoComplete="off"
              />
              {leadOptions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded border border-line bg-paper shadow-sm">
                  {leadOptions.map((lead) => (
                    <li key={lead.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-micro text-ink hover:bg-canvas"
                        onClick={() => {
                          setSelectedLead(lead);
                          setLeadOptions([]);
                          setLeadQuery('');
                        }}
                      >
                        {lead.name ?? '—'}
                        {lead.nickname && (
                          <span className="ml-1 text-ink-muted">({lead.nickname})</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searching && (
                <p className="mt-1 text-micro text-ink-muted">buscando...</p>
              )}
            </div>
          )}
        </div>

        {/* Transcrição */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="transcript">transcrição da call</Label>
            <span className="text-micro text-ink-muted normal-case tracking-normal">
              {charCount.toLocaleString('pt-BR')} caracteres
            </span>
          </div>
          <Textarea
            id="transcript"
            placeholder="Cole aqui o conteúdo do arquivo .txt — Anotações do Gemini ou transcrição do Meet"
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              if (feedback.state.kind !== 'idle') feedback.reset();
            }}
            rows={14}
            className="resize-y font-mono text-xs"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button
            onClick={handleSubmit}
            disabled={isPending || !transcript.trim()}
            variant="solid"
            size="sm"
          >
            {isPending ? 'analisando com gpt-4o...' : 'analisar call'}
          </Button>
          <ActionFeedback state={feedback.state} pendingLabel="enviando para análise..." />
        </div>

        {isPending && (
          <p className="text-micro text-ink-muted normal-case tracking-normal">
            Isso pode levar até 60 segundos — a call passa por duas análises (score + extração).
          </p>
        )}
      </Card>
    </div>
  );
}
