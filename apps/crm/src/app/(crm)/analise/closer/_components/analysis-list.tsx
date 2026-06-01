'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AnalysisListItem } from '@/server/queries/commercial';

const CIRCUMFERENCE = 2 * Math.PI * 20; // r=20

function scoreLabel(score: number): string {
  if (score >= 90) return 'ÓTIMO';
  if (score >= 80) return 'EXCELENTE';
  if (score >= 60) return 'BOM';
  return 'REGULAR';
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--color-leaf)';
  if (score >= 60) return 'var(--color-wood)';
  return 'var(--color-clay)';
}

function ScoreRing({ score }: { score: number }) {
  const fill = (score / 100) * CIRCUMFERENCE;
  const color = scoreColor(score);
  return (
    <div className="relative shrink-0" style={{ width: 56, height: 56 }}>
      <svg width={56} height={56} viewBox="0 0 56 56">
        {/* track */}
        <circle cx={28} cy={28} r={20} fill="none" stroke="var(--color-line)" strokeWidth={4} />
        {/* progress */}
        <circle
          cx={28}
          cy={28}
          r={20}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${fill} ${CIRCUMFERENCE}`}
          transform="rotate(-90 28 28)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[13px] font-semibold text-ink" style={{ color }}>
          {score}
        </span>
        <span className="mt-0.5 text-[7px] font-semibold tracking-wide text-ink-muted">
          {scoreLabel(score)}
        </span>
      </div>
    </div>
  );
}

function ResultBadge({ extracted }: { extracted: Record<string, unknown> | null }) {
  if (!extracted) return null;
  const fechou = extracted.fechou as boolean | null;
  const valor = extracted.orcamento_valor as number | null;

  if (fechou === true) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-leaf/15 px-2.5 py-0.5 text-[11px] font-semibold text-leaf">
          fechou
        </span>
        {valor && (
          <span className="text-btn text-ink-muted">
            {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
          </span>
        )}
      </div>
    );
  }
  if (fechou === false) {
    return (
      <span className="rounded-full bg-clay/15 px-2.5 py-0.5 text-[11px] font-semibold text-clay">
        não fechou
      </span>
    );
  }
  return null;
}

export function AnalysisList({
  items,
  basePath = '/analise/closer',
}: {
  items: AnalysisListItem[];
  basePath?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-micro text-ink-muted">
        nenhuma análise ainda.
      </p>
    );
  }

  return (
    <div className="divide-y divide-line">
      {items.map((item) => {
        const dateLabel = (() => {
          try {
            return format(parseISO(item.callDate), "EEEE, d 'de' MMMM", { locale: ptBR });
          } catch {
            return item.callDate;
          }
        })();

        return (
          <Link
            key={item.id}
            href={`${basePath}/${item.id}` as Route<string>}
            className="flex items-center gap-4 px-5 py-4 hover:bg-canvas transition-colors"
          >
            {item.overallScore !== null ? (
              <ScoreRing score={item.overallScore} />
            ) : (
              <div className="h-14 w-14 shrink-0 rounded-full bg-line" />
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-btn font-semibold text-ink">{item.title}</p>
              <p className="mt-0.5 text-micro text-ink-muted normal-case tracking-normal">
                {dateLabel}
                {item.leadName && <span> · {item.leadName}</span>}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <ResultBadge extracted={item.extractedData} />
              <span className="text-micro text-ink-muted normal-case tracking-normal">→</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
