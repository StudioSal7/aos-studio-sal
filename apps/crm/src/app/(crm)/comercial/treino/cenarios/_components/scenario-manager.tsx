'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import {
  createScenarioAction,
  draftScenarioAction,
  updateScenarioAction,
} from '@/server/actions/treino';

type Difficulty = 'facil' | 'medio' | 'dificil';

export type ScenarioDetail = {
  id: string;
  name: string;
  persona: string;
  context: string;
  objections: string[];
  spinFocus: string[];
  difficulty: Difficulty;
  sourceNote: string | null;
  active: boolean;
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facil: 'fácil',
  medio: 'médio',
  dificil: 'difícil',
};

const EMPTY: FormState = {
  name: '',
  persona: '',
  context: '',
  objections: '',
  spinFocus: '',
  difficulty: 'medio',
  sourceNote: '',
  active: true,
};

type FormState = {
  name: string;
  persona: string;
  context: string;
  objections: string; // uma por linha no form
  spinFocus: string; // separado por vírgula
  difficulty: Difficulty;
  sourceNote: string;
  active: boolean;
};

function toForm(s: ScenarioDetail): FormState {
  return {
    name: s.name,
    persona: s.persona,
    context: s.context,
    objections: s.objections.join('\n'),
    spinFocus: s.spinFocus.join(', '),
    difficulty: s.difficulty,
    sourceNote: s.sourceNote ?? '',
    active: s.active,
  };
}

export function ScenarioManager({ scenarios }: { scenarios: ScenarioDetail[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [transcript, setTranscript] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isDrafting, startDraft] = useTransition();
  const feedback = useActionFeedback();

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setTranscript('');
    feedback.reset();
  }

  function startEdit(s: ScenarioDetail) {
    setEditingId(s.id);
    setForm(toForm(s));
    setTranscript('');
    feedback.reset();
  }

  function handleDraft() {
    if (!transcript.trim()) return;
    feedback.pending();
    startDraft(async () => {
      const result = await draftScenarioAction({ transcript });
      if (result.ok && result.data) {
        setForm((f) => ({
          ...f,
          persona: result.data!.persona,
          context: result.data!.context,
          objections: result.data!.objections.join('\n'),
          sourceNote: f.sourceNote || 'extraído de transcrição',
        }));
        feedback.success('rascunho preenchido — revise antes de salvar');
      } else if (!result.ok) {
        feedback.error(result.error);
      }
    });
  }

  function handleSave() {
    feedback.pending();
    const payload = {
      name: form.name,
      persona: form.persona,
      context: form.context,
      objections: form.objections.split('\n').map((o) => o.trim()).filter(Boolean),
      spinFocus: form.spinFocus.split(',').map((s) => s.trim()).filter(Boolean),
      difficulty: form.difficulty,
      sourceNote: form.sourceNote,
      active: form.active,
    };
    startTransition(async () => {
      const result = editingId
        ? await updateScenarioAction(editingId, payload)
        : await createScenarioAction(payload);
      if (result.ok) {
        feedback.success('cenário salvo');
        startCreate();
        router.refresh();
      } else {
        feedback.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Lista */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 text-ink">cenários.</h2>
          <Button onClick={startCreate} variant="outline" size="sm">
            novo cenário
          </Button>
        </div>
        {scenarios.length === 0 ? (
          <p className="text-micro text-ink-muted normal-case tracking-normal">Nenhum cenário.</p>
        ) : (
          <ul className="space-y-2">
            {scenarios.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => startEdit(s)}
                  className={
                    editingId === s.id
                      ? 'w-full border border-ink bg-canvas px-4 py-3 text-left'
                      : 'w-full border border-line bg-paper px-4 py-3 text-left hover:bg-canvas'
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-body text-ink normal-case">{s.name}</span>
                    <span className="shrink-0 text-micro text-ink-muted">
                      {DIFFICULTY_LABEL[s.difficulty]}
                      {!s.active && ' · inativo'}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-micro text-ink-muted normal-case tracking-normal">
                    {s.persona}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Form */}
      <section className="space-y-4">
        <h2 className="text-h3 text-ink">{editingId ? 'editar cenário.' : 'novo cenário.'}</h2>

        {/* Extração de transcrição */}
        <Card className="space-y-2 p-4">
          <Label htmlFor="transcript">colar transcrição (opcional)</Label>
          <Textarea
            id="transcript"
            rows={4}
            placeholder="Cole uma transcrição real para extrair persona/contexto/objeções (revise antes de salvar)."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="resize-y font-mono text-xs"
          />
          <Button onClick={handleDraft} disabled={isDrafting || !transcript.trim()} variant="outline" size="sm">
            {isDrafting ? 'extraindo…' : 'extrair rascunho'}
          </Button>
        </Card>

        <Card className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">nome</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="difficulty">dificuldade</Label>
              <Select
                id="difficulty"
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}
              >
                <option value="facil">fácil</option>
                <option value="medio">médio</option>
                <option value="dificil">difícil</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="active">status</Label>
              <Select
                id="active"
                value={form.active ? 'true' : 'false'}
                onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}
              >
                <option value="true">ativo</option>
                <option value="false">inativo</option>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="persona">persona</Label>
            <Textarea id="persona" rows={3} value={form.persona} onChange={(e) => setForm({ ...form, persona: e.target.value })} className="resize-y" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="context">contexto</Label>
            <Textarea id="context" rows={3} value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} className="resize-y" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="objections">objeções (uma por linha)</Label>
            <Textarea id="objections" rows={3} value={form.objections} onChange={(e) => setForm({ ...form, objections: e.target.value })} className="resize-y" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spinFocus">foco SPIN (separado por vírgula)</Label>
            <Input id="spinFocus" placeholder="implicacao, necessidade" value={form.spinFocus} onChange={(e) => setForm({ ...form, spinFocus: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sourceNote">origem (opcional)</Label>
            <Input id="sourceNote" value={form.sourceNote} onChange={(e) => setForm({ ...form, sourceNote: e.target.value })} />
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleSave} disabled={isPending} variant="solid" size="sm">
              {isPending ? 'salvando…' : editingId ? 'salvar alterações' : 'criar cenário'}
            </Button>
            <ActionFeedback state={feedback.state} pendingLabel="salvando…" />
          </div>
        </Card>
      </section>
    </div>
  );
}
