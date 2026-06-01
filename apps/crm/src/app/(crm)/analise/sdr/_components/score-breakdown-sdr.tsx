import type { SdrScoreBreakdown } from '@repo/commercial/types';

const CRITERIA_LABELS: Record<keyof SdrScoreBreakdown, string> = {
  conducao_agendamento: 'condução ao agendamento',
  qualificacao: 'qualificação',
  rapport: 'rapport',
  clareza: 'clareza',
  velocidade_resposta: 'velocidade de resposta',
};

// Pesos para exibir a relevância visual de cada critério.
const WEIGHTS: Record<keyof SdrScoreBreakdown, number> = {
  conducao_agendamento: 30,
  qualificacao: 25,
  rapport: 20,
  clareza: 15,
  velocidade_resposta: 10,
};

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-leaf';
  if (score >= 60) return 'bg-wood';
  return 'bg-clay';
}

function scoreTextColor(score: number): string {
  if (score >= 80) return 'text-leaf';
  if (score >= 60) return 'text-wood';
  return 'text-clay';
}

export function ScoreBreakdownSdr({ breakdown }: { breakdown: SdrScoreBreakdown }) {
  const entries = (Object.entries(breakdown) as [keyof SdrScoreBreakdown, number | null][]).sort(
    ([a], [b]) => WEIGHTS[b] - WEIGHTS[a],
  );

  return (
    <div className="space-y-3">
      {entries.map(([key, score]) => {
        const evaluable = typeof score === 'number';
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-micro text-ink">
                {CRITERIA_LABELS[key]}
                <span className="ml-1.5 text-ink-muted">({WEIGHTS[key]}%)</span>
              </span>
              {evaluable ? (
                <span className={`text-micro font-medium ${scoreTextColor(score)}`}>{score}</span>
              ) : (
                <span className="text-micro text-ink-muted" title="não avaliável (sem timestamps)">
                  —
                </span>
              )}
            </div>
            <div className="h-1.5 w-full rounded-full bg-canvas">
              {evaluable && (
                <div
                  className={`h-full rounded-full transition-all ${scoreColor(score)}`}
                  style={{ width: `${score}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
