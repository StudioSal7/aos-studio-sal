import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

// KpiCard extraído do antigo mockup — mesmo visual, agora com dado real.
export function KpiCard({
  label,
  value,
  note,
  badge,
  valueColor,
}: {
  label: string;
  value: string | number;
  note?: string;
  badge?: ReactNode;
  valueColor?: string;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <p className="text-micro text-ink-muted">{label}</p>
        {badge}
      </div>
      <p
        className={`mt-3 break-words text-[26px] font-serif leading-[1.15] normal-case tabular-nums tracking-tight ${valueColor ?? 'text-ink'}`}
      >
        {value}
      </p>
      {note && <p className="mt-1 text-micro normal-case tracking-normal text-ink-muted">{note}</p>}
    </Card>
  );
}
