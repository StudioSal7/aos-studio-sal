'use client';

// Filtro de período discreto — mostra só a opção ativa (ex.: "7 dias") e
// expande as demais ao clicar. Dirigido por `?range=` (ou `paramName`) na URL;
// o pai (Server Component) lê o searchParams e resolve o recorte real.
// Genérico sobre o conjunto de opções — serve tanto pro DateRangeOption
// (dashboard/funil de vendas) quanto pro SalesRange de vendas-sal.

import { useRef } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

export function PeriodFilter<T extends string>({
  current,
  options,
  paramName = 'range',
}: {
  current: T;
  options: Array<{ value: T; label: string }>;
  paramName?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(option: T) {
    if (detailsRef.current) detailsRef.current.open = false;
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, option);
    router.push(`${pathname}?${params.toString()}` as Route<string>, { scroll: false });
  }

  const currentLabel = options.find((o) => o.value === current)?.label ?? current;
  const others = options.filter((o) => o.value !== current);

  return (
    <details ref={detailsRef} className="relative inline-block text-left">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 border border-line bg-canvas px-3 py-1.5 text-micro text-ink-muted marker:content-none hover:text-ink">
        {currentLabel}
        <ChevronDown size={12} strokeWidth={1.5} />
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1 min-w-[150px] border border-line bg-paper shadow-sm">
        {others.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => select(o.value)}
            className="block w-full px-3 py-2 text-left text-micro text-ink-muted hover:bg-canvas hover:text-ink"
          >
            {o.label}
          </button>
        ))}
      </div>
    </details>
  );
}
