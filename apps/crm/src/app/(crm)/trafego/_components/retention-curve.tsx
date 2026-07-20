import { Card } from '@/components/ui/card';
import type { RetentionCurveRow } from '@/server/lib/ads-report/index';
import { pct } from './format';

// Vista Curva: retenção 3s→25→50→75→95 lado a lado por criativo (small
// multiples) — o objetivo é achar o DEGRAU da sangria, não a média. Barras
// relativas ao 3s de cada criativo (estilo do funil de vídeo do mockup).

const STEP_LABELS: Record<string, string> = {
  '3s': '3 segundos',
  p25: '25%',
  p50: '50%',
  p75: '75%',
  p95: '95%',
};

export function RetentionCurves({ curves }: { curves: RetentionCurveRow[] }) {
  if (curves.length === 0) {
    return (
      <Card>
        <p className="text-body text-ink-muted">
          nenhum criativo com entrega neste segmento na janela de decisão.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 [&>*]:min-w-0">
      {curves.map((curve) => {
        const base = curve.steps[0]?.count ?? 0; // 3s = 100% da barra
        return (
          <Card key={curve.adId} className="min-w-0 overflow-hidden">
            <p className="truncate text-[12px] normal-case tracking-normal text-ink" title={curve.adName}>
              {curve.adName}
            </p>
            <p className="mt-0.5 text-micro normal-case tracking-normal text-ink-muted">
              {curve.impressions.toLocaleString('pt-BR')} impressões · hook{' '}
              {pct(curve.steps[0]?.pctOfPrev ?? null)}
            </p>
            <div className="mt-4 space-y-2">
              {curve.steps.map((step, i) => {
                const widthPct = base > 0 ? Math.max((step.count / base) * 100, 0.5) : 0;
                // Degrau com retenção < 50% sobre o anterior = candidato a sangria
                const isBleed = i > 0 && step.pctOfPrev !== null && step.pctOfPrev < 0.5;
                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-right text-[11px] normal-case tracking-normal text-ink-muted">
                      {STEP_LABELS[step.label]}
                    </span>
                    <div className="relative h-5 flex-1 bg-canvas">
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{ width: `${widthPct}%`, backgroundColor: isBleed ? '#dc2626' : '#a8a29e' }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right tabular-nums text-[11px] text-ink">
                      {step.count.toLocaleString('pt-BR')}
                    </span>
                    <span
                      className={`w-12 shrink-0 text-right tabular-nums text-[11px] ${isBleed ? 'font-medium text-red-600' : 'text-ink-muted'}`}
                    >
                      {i === 0 ? '100%' : pct(step.pctOfPrev, 0)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] normal-case tracking-normal text-ink-muted">
              % sobre o degrau anterior · vermelho = retenção &lt; 50% (degrau da sangria)
            </p>
          </Card>
        );
      })}
    </div>
  );
}
