import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth';
import { listProducts } from '@/server/queries/products';
import { PageHeader } from '@/components/ui/page-header';
import { formatCents } from '@/lib/money';
import { productTipoLabel } from '@/lib/product-tipo';
import { ProductFormModal } from './_components/product-form-modal';
import { ToggleActiveButton } from './_components/toggle-active-button';

export default async function ProdutosPage() {
  const auth = await requireAuth();
  if (auth.role !== 'owner') redirect('/kanban');

  const products = await listProducts();

  return (
    <div className="flex flex-col">
      <PageHeader title="produtos.">
        <ProductFormModal mode="create" />
      </PageHeader>

      <div className="p-8">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-line bg-paper py-20 text-center">
            <p className="text-body text-ink-muted">
              Nenhum produto ainda. Crie o primeiro para vincular no fechamento.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden border border-line bg-paper">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-canvas">
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">Nome</th>
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">Tipo</th>
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">Valor</th>
                  <th className="px-6 py-3 text-left text-micro text-ink-muted">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-6 py-3 text-body text-ink">{p.displayName}</td>
                    <td className="px-6 py-3 text-micro text-ink-muted">
                      {productTipoLabel(p.tipo)}
                    </td>
                    <td className="px-6 py-3 text-body tabular-nums text-ink">
                      {formatCents(p.valorCents)}
                    </td>
                    <td className="px-6 py-3 text-micro text-ink-muted">
                      {p.active ? 'ativo' : 'inativo'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <ProductFormModal mode="edit" product={p} />
                        <ToggleActiveButton id={p.id} active={p.active} />
                      </div>
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
