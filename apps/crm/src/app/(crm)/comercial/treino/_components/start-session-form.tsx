'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import { startSessionAction } from '@/server/actions/treino';
import { searchLeadsAction } from '@/server/actions/commercial';

type ScenarioOption = { id: string; name: string; difficulty: string };
type CloserOption = { id: string; label: string };
type LeadOption = { id: string; name: string | null; nickname: string | null };

const DIFFICULTY_LABEL: Record<string, string> = {
  facil: 'fácil',
  medio: 'médio',
  dificil: 'difícil',
};

export function StartSessionForm({
  scenarios,
  closers,
}: {
  scenarios: ScenarioOption[];
  closers: CloserOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const feedback = useActionFeedback();

  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? '');
  const [traineeLabel, setTraineeLabel] = useState(closers[0]?.label ?? '');

  const [leadQuery, setLeadQuery] = useState('');
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);

  const searchLeads = useCallback(async (q: string) => {
    setLeadQuery(q);
    if (q.trim().length < 2) {
      setLeadOptions([]);
      return;
    }
    const results = await searchLeadsAction(q);
    setLeadOptions(results);
  }, []);

  function handleStart() {
    feedback.pending();
    startTransition(async () => {
      const result = await startSessionAction({
        scenarioId,
        traineeLabel,
        leadId: selectedLead?.id,
      });
      if (result.ok && result.data) {
        router.push(`/comercial/treino/${result.data.id}` as Route<string>);
      } else if (!result.ok) {
        feedback.error(result.error);
      }
    });
  }

  if (scenarios.length === 0) {
    return (
      <p className="text-micro text-ink-muted normal-case tracking-normal">
        Nenhum cenário ativo. Crie um em{' '}
        <a className="underline" href="/comercial/treino/cenarios">
          cenários
        </a>
        .
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="scenario">cenário</Label>
          <Select id="scenario" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({DIFFICULTY_LABEL[s.difficulty] ?? s.difficulty})
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="trainee">quem está treinando</Label>
          {closers.length > 0 ? (
            <Select id="trainee" value={traineeLabel} onChange={(e) => setTraineeLabel(e.target.value)}>
              {closers.map((c) => (
                <option key={c.id} value={c.label}>
                  {c.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id="trainee"
              placeholder="nome de quem treina"
              value={traineeLabel}
              onChange={(e) => setTraineeLabel(e.target.value)}
            />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="leadSearch">lead vinculado (opcional)</Label>
        {selectedLead ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 border border-line bg-canvas px-3 py-2 text-micro text-ink">
              {selectedLead.name ?? selectedLead.nickname ?? selectedLead.id}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedLead(null);
                setLeadQuery('');
                setLeadOptions([]);
              }}
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
              <ul className="absolute z-10 mt-1 w-full border border-line bg-paper shadow-sm">
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
                      {lead.nickname && <span className="ml-1 text-ink-muted">({lead.nickname})</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={handleStart} disabled={isPending || !scenarioId || !traineeLabel.trim()} variant="solid" size="sm">
          {isPending ? 'iniciando…' : 'iniciar treino'}
        </Button>
        <ActionFeedback state={feedback.state} pendingLabel="iniciando…" />
      </div>
    </div>
  );
}
