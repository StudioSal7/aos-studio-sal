import type {
  RoleplayFeedbackDossier,
  RoleplayScoreBreakdown,
} from '@repo/commercial/types';
import { Card } from '@/components/ui/card';

const CRITERION_LABELS: Record<keyof RoleplayScoreBreakdown, string> = {
  situacao: 'situação (S)',
  problema: 'problema (P)',
  implicacao: 'implicação (I)',
  necessidade: 'necessidade (N)',
  conducao_escuta: 'condução & escuta',
};

const CRITERION_ORDER: (keyof RoleplayScoreBreakdown)[] = [
  'situacao',
  'problema',
  'implicacao',
  'necessidade',
  'conducao_escuta',
];

export function FeedbackDossier({
  overallScore,
  breakdown,
  feedback,
}: {
  overallScore: number | null;
  breakdown: RoleplayScoreBreakdown | null;
  feedback: RoleplayFeedbackDossier;
}) {
  const notas = breakdown ?? feedback.notas;

  return (
    <div className="space-y-6">
      {/* Leitura + nota global */}
      <Card className="flex items-start justify-between gap-6 p-6">
        <div className="min-w-0">
          <p className="text-micro text-ink-muted">leitura</p>
          <p className="mt-1 text-h3 text-ink normal-case">{feedback.leitura_1_linha || '—'}</p>
          {feedback.proximo_foco && (
            <p className="mt-3 text-micro text-ink-muted normal-case tracking-normal">
              próximo foco: {feedback.proximo_foco}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-micro text-ink-muted">nota</p>
          <p className="text-display text-ink">{overallScore ?? '—'}</p>
          <p className="text-micro text-ink-muted normal-case tracking-normal">/ 100</p>
        </div>
      </Card>

      {/* Notas por critério */}
      <section>
        <h2 className="mb-3 text-h3 text-ink">notas por critério.</h2>
        <Card className="space-y-3 p-6">
          {CRITERION_ORDER.map((key) => (
            <CriterionBar key={key} label={CRITERION_LABELS[key]} value={notas[key]} />
          ))}
        </Card>
      </section>

      {/* Melhores momentos */}
      <section>
        <h2 className="mb-3 text-h3 text-ink">melhores momentos.</h2>
        <div className="space-y-3">
          {feedback.melhores_momentos.length === 0 && (
            <p className="text-micro text-ink-muted normal-case tracking-normal">—</p>
          )}
          {feedback.melhores_momentos.map((m, i) => (
            <Card key={i} className="space-y-2 p-4">
              <p className="text-body text-ink normal-case">{m.texto}</p>
              {m.trecho && (
                <blockquote className="border-l-2 border-leaf pl-3 text-micro text-ink-muted normal-case tracking-normal">
                  “{m.trecho}”
                </blockquote>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* Perguntas fracas + reescrita */}
      <section>
        <h2 className="mb-1 text-h3 text-ink">perguntas a reforçar.</h2>
        <p className="mb-3 text-micro text-ink-muted normal-case tracking-normal">
          o que você perguntou × uma versão mais forte
        </p>
        <div className="space-y-3">
          {feedback.perguntas_fracas.length === 0 && (
            <p className="text-micro text-ink-muted normal-case tracking-normal">—</p>
          )}
          {feedback.perguntas_fracas.map((q, i) => (
            <Card key={i} className="space-y-2 p-4">
              <p className="text-micro text-clay normal-case tracking-normal">
                você: “{q.original || '—'}”
              </p>
              <p className="text-body text-ink normal-case">→ {q.reescrita || '—'}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Perguntas-modelo */}
      <section>
        <h2 className="mb-3 text-h3 text-ink">perguntas-modelo pra este cenário.</h2>
        <Card className="space-y-3 p-4">
          {feedback.perguntas_modelo.length === 0 && (
            <p className="text-micro text-ink-muted normal-case tracking-normal">—</p>
          )}
          {feedback.perguntas_modelo.map((q, i) => (
            <div key={i} className="space-y-0.5">
              {q.etapa && (
                <p className="text-micro text-ink-muted">{q.etapa}</p>
              )}
              <p className="text-body text-ink normal-case">{q.pergunta}</p>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}

function CriterionBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 10) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-micro text-ink normal-case tracking-normal">{label}</span>
        <span className="text-micro text-ink-muted">{value.toFixed(1)} / 10</span>
      </div>
      <div className="h-2 w-full bg-canvas">
        <div className="h-2 bg-leaf" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
