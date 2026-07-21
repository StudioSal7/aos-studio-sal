'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EntryForm } from './entry-form';

export function CreateEntryButton({
  categories,
}: {
  categories: { id: string; name: string; entryKind: 'receita' | 'despesa' }[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        novo lançamento
      </Button>
    );
  }

  return <EntryForm categories={categories} onDone={() => setOpen(false)} />;
}
