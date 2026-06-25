import type { RoleplayScoreBreakdown } from '@repo/commercial/types';
import { Card } from '@/components/ui/card';
import type { TraineeTrend } from '@/server/queries/treino';

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

export function TraineeTrends({ trend }: { trend: TraineeTrend }) {
  if (trend.totalSessions === 0 || !trend.avgByCriterion) {
    return (
      <Card className="p-6">
        <p className="text-micro text-ink-muted normal-case tracking-normal">
          Sem sessões avaliadas ainda — a tendência aparece após o primeiro “encerrar e avaliar”.
        </p>
      </Card>
    );
  }

  const weakest = trend.weakestCriterion;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-micro text-ink-muted">sessões avaliadas</p>
          <p className="mt-1 text-display">{trend.totalSessions}</p>
        </Card>
        <Card className="p-4">
          <p className="text-micro text-ink-muted">nota média</p>
          <p className="mt-1 text-display">{trend.avgOverall ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-micro text-ink-muted">SPIN mais fraco</p>
          <p className="mt-1 text-h3 text-clay normal-case">
            {weakest ? CRITERION_LABELS[weakest] : '—'}
          </p>
        </Card>
      </div>

      <Card className="space-y-3 p-6">
        <p className="text-micro text-ink-muted">média por critério (0–10)</p>
        {CRITERION_ORDER.map((key) => {
          const value = trend.avgByCriterion![key];
          const pct = Math.max(0, Math.min(100, (value / 10) * 100));
          const isWeakest = key === weakest;
          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-micro text-ink normal-case tracking-normal">
                  {CRITERION_LABELS[key]}
                </span>
                <span className="text-micro text-ink-muted">{value.toFixed(1)}</span>
              </div>
              <div className="h-2 w-full bg-canvas">
                <div
                  className={isWeakest ? 'h-2 bg-clay' : 'h-2 bg-leaf'}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </Card>

      {trend.timeline.length > 1 && (
        <Card className="p-6">
          <p className="mb-3 text-micro text-ink-muted">evolução da nota (mais antiga → recente)</p>
          <div className="flex items-end gap-1" style={{ height: 80 }}>
            {trend.timeline.map((t, i) => (
              <div
                key={i}
                className="flex-1 bg-ink"
                style={{ height: `${Math.max(4, t.score)}%` }}
                title={`${t.score}`}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
