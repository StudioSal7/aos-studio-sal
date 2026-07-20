import type { ProductTipo } from '@repo/db/schema';

// Rótulos legíveis dos tipos de produto — fonte única, reusada no catálogo,
// no admin de contratos e na lista de contratos do lead.
export const PRODUCT_TIPO_LABEL: Record<ProductTipo, string> = {
  mentoria: 'mentoria',
  assessoria: 'assessoria',
  branding_pessoal: 'branding pessoal',
  infoproduto: 'infoproduto',
};

export function productTipoLabel(tipo: string | null | undefined): string {
  if (!tipo) return '—';
  return PRODUCT_TIPO_LABEL[tipo as ProductTipo] ?? tipo;
}
