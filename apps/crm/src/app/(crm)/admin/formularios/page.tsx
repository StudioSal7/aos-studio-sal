import type { Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ExternalLink, FileText } from 'lucide-react';
import { requireAuth } from '@/server/auth';
import { listForms } from '@/server/queries/forms';
import { PageHeader } from '@/components/ui/page-header';
import { CreateFormButton } from './_components/create-form-button';

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'rascunho',
  ativo: 'ativo',
  pausado: 'pausado',
  encerrado: 'encerrado',
};

export default async function FormulariosPage() {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const forms = await listForms();

  return (
    <div className="flex flex-col">
      <PageHeader title="formulários.">
        <CreateFormButton />
      </PageHeader>

      <div className="p-8">
        {forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-line bg-paper py-20 text-center">
            <FileText size={32} strokeWidth={1.5} className="text-ink-muted" />
            <p className="mt-4 text-body text-ink-muted">
              Nenhum formulário ainda. Crie o primeiro para substituir o Respondi.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden border border-line bg-paper">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-canvas">
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">Título</th>
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">Status</th>
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">Respostas</th>
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">Link público</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {forms.map((f) => (
                  <tr key={f.id} className="border-b border-line last:border-0">
                    <td className="px-6 py-3">
                      <Link
                        href={`/admin/formularios/${f.id}` as Route<string>}
                        className="text-body text-ink underline-offset-4 hover:underline"
                      >
                        {f.titulo}
                      </Link>
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={f.status} label={STATUS_LABEL[f.status] ?? f.status} />
                    </td>
                    <td className="px-6 py-3 text-body tabular-nums text-ink">
                      {f.responsesCount}
                    </td>
                    <td className="px-6 py-3">
                      {f.status === 'ativo' ? (
                        <a
                          href={`/f/${f.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-btn text-wood hover:text-wood-hover"
                        >
                          /f/{f.slug}
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <span className="text-btn text-ink-muted">/f/{f.slug}</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Link
                        href={`/admin/formularios/${f.id}` as Route<string>}
                        className="text-btn text-ink-muted hover:text-ink"
                      >
                        editar.
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    status === 'ativo'
      ? 'border-leaf text-leaf'
      : status === 'pausado'
        ? 'border-wood text-wood'
        : status === 'encerrado'
          ? 'border-ink-muted text-ink-muted'
          : 'border-line text-ink-muted';
  return (
    <span className={`inline-block border px-2 py-0.5 text-micro normal-case tracking-normal ${tone}`}>
      {label}
    </span>
  );
}
