'use client';

import type { Route } from 'next';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createFormAction } from '@/server/actions/forms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

export function CreateFormButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createFormAction({ titulo });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setTitulo('');
      router.push(`/admin/formularios/${res.data!.id}` as Route<string>);
    });
  }

  return (
    <>
      <Button variant="solid" size="sm" onClick={() => setOpen(true)}>
        <Plus size={16} className="mr-1.5" />
        novo formulário
      </Button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <h2 className="text-h3 text-ink">novo formulário.</h2>
          <div>
            <label className="mb-1.5 block text-micro text-ink-muted">Título</label>
            <Input
              autoFocus
              value={titulo}
              placeholder="Ex: Aplicação branding essencial"
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && titulo.trim()) submit();
              }}
            />
          </div>
          {error && <p className="text-sm text-clay">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              cancelar
            </Button>
            <Button variant="solid" size="sm" onClick={submit} disabled={pending || !titulo.trim()}>
              {pending ? 'criando…' : 'criar'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
