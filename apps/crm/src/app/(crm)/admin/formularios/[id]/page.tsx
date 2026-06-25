import type { Route } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/server/auth';
import { getFormForEdit } from '@/server/queries/forms';
import { FormBuilder } from './_components/form-builder';
import { FormActions } from './_components/form-actions';

export default async function FormEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const { id } = await params;
  const form = await getFormForEdit(id);
  if (!form) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-paper px-8">
        <Link
          href={'/admin/formularios' as Route<string>}
          className="flex items-center gap-1.5 text-btn text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={16} />
          formulários.
        </Link>
        <FormActions formId={form.id} titulo={form.titulo} />
      </header>

      <FormBuilder initialForm={form} />
    </div>
  );
}
