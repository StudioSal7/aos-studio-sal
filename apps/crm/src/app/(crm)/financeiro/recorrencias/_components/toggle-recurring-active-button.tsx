'use client';

import { useTransition } from 'react';
import { toggleFinancialRecurringTemplateActiveAction } from '@/server/actions/financial-recurring';

export function ToggleRecurringActiveButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleFinancialRecurringTemplateActiveAction(id, !active);
        })
      }
      className="text-micro text-ink-muted normal-case tracking-normal hover:text-ink disabled:opacity-50"
    >
      {active ? 'desativar' : 'ativar'}
    </button>
  );
}
