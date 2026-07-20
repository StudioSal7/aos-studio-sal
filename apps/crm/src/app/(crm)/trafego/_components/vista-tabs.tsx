'use client';

// Tabs URL-driven (?vista=) — mesmo padrão do lead-detail-tabs: estado real na
// URL, server component re-lê searchParams e renderiza a vista ativa.

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { VISTAS, type VistaKey } from './vistas';

export function VistaTabs({ active }: { active: VistaKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(vista: VistaKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('vista', vista);
    router.replace(`${pathname}?${params.toString()}` as Route<string>, { scroll: false });
  }

  return (
    <nav className="flex gap-0 border-b border-line" aria-label="vistas de tráfego">
      {VISTAS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => select(tab.key)}
            aria-current={isActive ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-micro transition-colors ${
              isActive
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-muted hover:border-line hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
