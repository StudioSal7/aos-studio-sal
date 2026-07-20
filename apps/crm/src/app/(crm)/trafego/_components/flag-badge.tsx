import type { DecisionFlag } from '@/server/lib/ads-decision-engine/index';

// Badge de veredito do motor de decisão + badges auxiliares (segmento, fadiga).
// Estende o estilo do antigo AcaoBadge do mockup (rounded-sm, 10px, lowercase).

const FLAG_STYLES: Record<DecisionFlag, { label: string; className: string }> = {
  escalar: { label: 'escalar', className: 'bg-emerald-100 text-emerald-700' },
  winner: { label: 'winner', className: 'bg-emerald-700 text-white' },
  matar: { label: 'matar', className: 'bg-red-100 text-red-700' },
  iterar: { label: 'iterar', className: 'bg-canvas text-ink-muted' },
  volume_insuficiente: { label: 'volume insuficiente', className: 'bg-amber-100 text-amber-700' },
  sem_alvo: { label: 'sem alvo', className: 'border border-line bg-paper text-ink-muted' },
};

export function FlagBadge({ flag }: { flag: DecisionFlag }) {
  const style = FLAG_STYLES[flag];
  return (
    <span
      className={`inline-block shrink-0 whitespace-nowrap rounded-sm px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal ${style.className}`}
    >
      {style.label}
    </span>
  );
}

export function FadigaBadge() {
  return (
    <span className="inline-block shrink-0 whitespace-nowrap rounded-sm bg-orange-100 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-orange-700">
      fadiga
    </span>
  );
}

const SEGMENT_STYLES: Record<string, string> = {
  frio: 'bg-blue-100 text-blue-700',
  quente: 'bg-amber-100 text-amber-700',
  nao_classificado: 'border border-red-200 bg-red-50 text-red-700',
};

export function SegmentBadge({ segment }: { segment: string }) {
  const className = SEGMENT_STYLES[segment] ?? 'bg-canvas text-ink-muted';
  const label = segment === 'nao_classificado' ? 'não classificado' : segment;
  return (
    <span
      className={`inline-block shrink-0 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal ${className}`}
    >
      {label}
    </span>
  );
}
