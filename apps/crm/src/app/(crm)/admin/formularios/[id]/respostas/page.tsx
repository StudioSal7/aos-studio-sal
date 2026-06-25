import type { Route } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/server/auth';
import { getFormResponses } from '@/server/queries/forms';

const TZ = 'America/Sao_Paulo';

export default async function FormResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const { id } = await params;
  const data = await getFormResponses(id);
  if (!data) notFound();

  const { form, fields, responses } = data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-paper px-8">
        <Link
          href={`/admin/formularios/${form.id}` as Route<string>}
          className="flex items-center gap-1.5 text-btn text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={16} />
          {form.titulo}
        </Link>
        <span className="text-micro text-ink-muted">
          {responses.length} {responses.length === 1 ? 'resposta' : 'respostas'}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-8">
        {responses.length === 0 ? (
          <p className="text-body text-ink-muted">Nenhuma resposta ainda.</p>
        ) : (
          <div className="overflow-x-auto border border-line bg-paper">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-canvas">
                  <th className="whitespace-nowrap px-4 py-3 text-left text-micro text-ink-muted">
                    Quando
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-micro text-ink-muted">
                    Lead
                  </th>
                  {fields.map((f) => (
                    <th
                      key={f.id}
                      className="whitespace-nowrap px-4 py-3 text-left text-micro text-ink-muted"
                    >
                      {f.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {responses.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-body text-ink-muted">
                      {new Date(r.concluidoEm).toLocaleString('pt-BR', {
                        timeZone: TZ,
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-body">
                      {r.leadId ? (
                        <Link
                          href={`/leads/${r.leadId}` as Route<string>}
                          className="text-wood underline-offset-4 hover:underline"
                        >
                          {r.leadName ?? 'ver lead'}
                        </Link>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    {fields.map((f) => (
                      <td key={f.id} className="px-4 py-3 text-body text-ink">
                        {formatAnswer(r.dados[f.id])}
                      </td>
                    ))}
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

function formatAnswer(value: unknown): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}
