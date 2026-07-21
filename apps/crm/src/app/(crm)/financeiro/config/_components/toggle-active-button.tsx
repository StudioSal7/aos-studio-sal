'use client';

import { useTransition } from 'react';
import {
  toggleFinancialAccountActiveAction,
  toggleFinancialCategoryActiveAction,
} from '@/server/actions/financial';

// Fechaduras (arrow functions) não atravessam a fronteira Server→Client como
// prop — só a Server Action em si é serializável. Por isso o componente chama
// a action certa internamente, parametrizado por `entity`.
export function ToggleActiveButton({
  entity,
  id,
  active,
}: {
  entity: 'account' | 'category';
  id: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (entity === 'account') {
            await toggleFinancialAccountActiveAction(id, !active);
          } else {
            await toggleFinancialCategoryActiveAction(id, !active);
          }
        })
      }
      className="text-micro text-ink-muted normal-case tracking-normal hover:text-ink disabled:opacity-50"
    >
      {active ? 'desativar' : 'ativar'}
    </button>
  );
}
