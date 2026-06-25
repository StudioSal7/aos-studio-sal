'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

export function CollapsibleNavGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 pb-1"
      >
        <span className="text-micro text-ink-muted tracking-wide">{label}</span>
        <ChevronDown
          size={12}
          strokeWidth={1.5}
          className={`text-ink-muted transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  );
}
