'use client';

// Seletor de período do dashboard — mesma estética details/summary do
// PeriodFilter compartilhado (components/ui/period-filter.tsx), mas com
// componente PRÓPRIO: precisa de um rodapé "personalizado" com from/to que o
// PeriodFilter genérico não modela. Não editar o compartilhado — ele segue
// sendo usado por /vendas-sal.

import { useRef, useState } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DATE_RANGE_OPTIONS, type DateRangeOption } from '@/server/lib/date-range/index';

export function DashboardPeriodFilter({
  current,
  label,
  customFrom,
  customTo,
}: {
  current: DateRangeOption;
  label: string;
  customFrom?: string;
  customTo?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(customFrom ?? '');
  const [to, setTo] = useState(customTo ?? '');

  function close() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  function selectPreset(option: Exclude<DateRangeOption, 'custom'>) {
    close();
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', option);
    params.delete('from');
    params.delete('to');
    router.push(`${pathname}?${params.toString()}` as Route<string>, { scroll: false });
  }

  function applyCustom() {
    if (!from || !to) return;
    close();
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', 'custom');
    params.set('from', from);
    params.set('to', to);
    router.push(`${pathname}?${params.toString()}` as Route<string>, { scroll: false });
  }

  const others = DATE_RANGE_OPTIONS.filter((o) => o.value !== current);

  return (
    <details ref={detailsRef} className="relative inline-block text-left">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 border border-line bg-canvas px-3 py-1.5 text-micro text-ink-muted marker:content-none hover:text-ink">
        {label}
        <ChevronDown size={12} strokeWidth={1.5} />
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1 min-w-[220px] border border-line bg-paper shadow-sm">
        {others.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => selectPreset(o.value)}
            className="block w-full px-3 py-2 text-left text-micro text-ink-muted hover:bg-canvas hover:text-ink"
          >
            {o.label}
          </button>
        ))}
        <div className="border-t border-line p-3">
          <p className="mb-2 text-micro text-ink-muted">personalizado</p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="data de início do período personalizado"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border border-line bg-canvas px-2 py-1.5 text-micro text-ink"
            />
            <span className="text-micro text-ink-muted">–</span>
            <input
              type="date"
              aria-label="data de fim do período personalizado"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border border-line bg-canvas px-2 py-1.5 text-micro text-ink"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!from || !to}
            onClick={applyCustom}
            className="mt-2 w-full"
          >
            aplicar
          </Button>
        </div>
      </div>
    </details>
  );
}
