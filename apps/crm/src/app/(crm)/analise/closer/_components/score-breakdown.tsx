import type { CloserBlockScores } from '@repo/commercial/types';

// Blocos A–G da régua Winning by Design (closer-v2), em ordem do método.
const BLOCK_LABELS: Record<keyof CloserBlockScores, string> = {
  abertura: 'abertura & conexão',
  conducao: 'condução & controle',
  diagnostico: 'diagnóstico',
  desejo: 'desejo',
  implicacao: 'implicação',
  urgencia: 'urgência',
  fechamento: 'fechamento',
};

const BLOCK_ORDER: (keyof CloserBlockScores)[] = [
  'abertura',
  'conducao',
  'diagnostico',
  'desejo',
  'implicacao',
  'urgencia',
  'fechamento',
];

// Cores por faixa (nota 0–10).
function scoreColor(score10: number): string {
  if (score10 >= 8) return 'bg-leaf';
  if (score10 >= 6) return 'bg-wood';
  return 'bg-clay';
}

function scoreTextColor(score10: number): string {
  if (score10 >= 8) return 'text-leaf';
  if (score10 >= 6) return 'text-wood';
  return 'text-clay';
}

export function ScoreBreakdown({
  blocos,
  pesos,
}: {
  blocos: CloserBlockScores;
  pesos: CloserBlockScores;
}) {
  return (
    <div className="space-y-3">
      {BLOCK_ORDER.map((key) => {
        const score10 = blocos[key] ?? 0;
        const pct = Math.round((pesos[key] ?? 0) * 100);
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-micro text-ink">
                {BLOCK_LABELS[key]}
                <span className="ml-1.5 text-ink-muted">({pct}%)</span>
              </span>
              <span className={`text-micro font-medium ${scoreTextColor(score10)}`}>
                {score10.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-canvas">
              <div
                className={`h-full rounded-full transition-all ${scoreColor(score10)}`}
                style={{ width: `${Math.max(0, Math.min(100, score10 * 10))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
