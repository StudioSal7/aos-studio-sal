'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setProductActiveAction } from '@/server/actions/products';

export function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setProductActiveAction(id, !active);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="text-btn text-ink-muted hover:text-ink disabled:opacity-50"
    >
      {active ? 'desativar.' : 'ativar.'}
    </button>
  );
}
