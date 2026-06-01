import type { CloserScoreBreakdown } from '@repo/commercial/types';

const CRITERIA_LABELS: Record<keyof CloserScoreBreakdown, string> = {
  fechamento: 'fechamento',
  conducao: 'condução',
  tecnica_vendas: 'técnica de vendas',
  escuta_ativa: 'escuta ativa',
  clareza: 'clareza',
  rapport: 'rapport',
};

// Pesos para exibir a relevância visual de cada critério
const WEIGHTS: Record<keyof CloserScoreBreakdown, number> = {
  fechamento: 30,
  conducao: 20,
  tecnica_vendas: 20,
  escuta_ativa: 10,
  clareza: 10,
  rapport: 10,
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

export function ScoreBreakdown({ breakdown }: { breakdown: CloserScoreBreakdown }) {
  const entries = (Object.entries(breakdown) as [keyof CloserScoreBreakdown, number][]).sort(
    ([a], [b]) => WEIGHTS[b] - WEIGHTS[a],
  );

  return (
    <div className="space-y-3">
      {entries.map(([key, score]) => (
        <div key={key} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-micro text-ink">
              {CRITERIA_LABELS[key]}
              <span className="ml-1.5 text-ink-muted">({WEIGHTS[key]}%)</span>
            </span>
            <span className={`text-micro font-medium ${scoreTextColor(score)}`}>{score}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-canvas">
            <div
              className={`h-full rounded-full transition-all ${scoreColor(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
