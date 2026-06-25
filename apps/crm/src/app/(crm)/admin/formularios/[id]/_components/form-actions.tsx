'use client';

import type { Route } from 'next';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Inbox, Trash2 } from 'lucide-react';
import { deleteFormAction, duplicateFormAction } from '@/server/actions/forms';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

export function FormActions({ formId, titulo }: { formId: string; titulo: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function duplicate() {
    startTransition(async () => {
      const res = await duplicateFormAction({ formId });
      if (res.ok && res.data) {
        router.push(`/admin/formularios/${res.data.id}` as Route<string>);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteFormAction({ formId });
      if (res.ok) {
        router.push('/admin/formularios' as Route<string>);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/formularios/${formId}/respostas` as Route<string>}
        className="inline-flex items-center gap-1.5 text-btn text-ink-muted hover:text-ink"
      >
        <Inbox size={16} />
        respostas.
      </Link>
      <Button variant="ghost" size="sm" onClick={duplicate} disabled={pending}>
        <Copy size={15} className="mr-1.5" />
        duplicar
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} disabled={pending}>
        <Trash2 size={15} className="mr-1.5" />
        excluir
      </Button>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <div className="space-y-4">
          <h2 className="text-h3 text-ink">excluir formulário?</h2>
          <p className="text-body text-ink-muted">
            “{titulo}” e todas as suas respostas serão apagados permanentemente. Os leads já criados
            por ele <strong>permanecem</strong> no CRM. Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              cancelar
            </Button>
            <Button
              variant="solid"
              size="sm"
              onClick={remove}
              disabled={pending}
              className="bg-clay hover:bg-clay"
            >
              {pending ? 'excluindo…' : 'excluir'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
