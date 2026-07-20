import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth';
import { listContractTemplates } from '@/server/queries/contracts';
import { PageHeader } from '@/components/ui/page-header';
import { productTipoLabel } from '@/lib/product-tipo';
import { UploadTemplateForm } from './_components/upload-template-form';

export default async function ContratosPage() {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const templates = await listContractTemplates();

  return (
    <div className="flex flex-col">
      <PageHeader title="contratos." />

      <div className="p-8">
        <p className="mb-6 max-w-2xl text-body text-ink-muted">
          Um template <span className="font-medium text-ink">.docx</span> por tipo de produto —
          usado no mail-merge quando o closer gera o contrato de um lead pago. Trocar o
          template aqui reflete no próximo contrato gerado, sem precisar de deploy.
        </p>

        <div className="overflow-hidden border border-line bg-paper">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-canvas">
                <th className="px-6 py-3 text-left text-micro text-ink-muted">Tipo</th>
                <th className="px-6 py-3 text-left text-micro text-ink-muted">Template</th>
                <th className="px-6 py-3 text-left text-micro text-ink-muted">Atualizado em</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.tipo} className="border-b border-line last:border-0">
                  <td className="px-6 py-3 text-body text-ink">
                    {productTipoLabel(t.tipo)}
                  </td>
                  <td className="px-6 py-3 text-micro text-ink-muted">
                    {t.exists ? 'enviado' : 'nenhum template ainda'}
                  </td>
                  <td className="px-6 py-3 text-micro text-ink-muted">
                    {t.updatedAt
                      ? new Date(t.updatedAt).toLocaleString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <UploadTemplateForm tipo={t.tipo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
