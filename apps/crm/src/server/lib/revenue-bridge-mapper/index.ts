/**
 * Mapeia as duas fontes de receita existentes (venda Hotmart aprovada / lead
 * em estágio `paid`) para o formato de inserção de `financial_entries`. Puro
 * — a query fina por cima decide o que já existe (idempotência via índice
 * único por origem) e faz o insert.
 *
 * Curso (Hotmart) e mentoria/consultoria (CRM, por fora) são produtos
 * distintos, sem sobreposição (confirmado pelo André, 16/07/2026) — por isso
 * as duas fontes só SOMAM, sem regra de casamento/dedup entre si.
 */

export interface HotmartSaleInput {
  id: string;
  purchasedAt: Date;
  commissionCents: number;
}

export interface LeadPaidInput {
  id: string;
  valorProposto: string | null; // numeric do Postgres chega como string
}

export interface RevenueEntryDraft {
  kind: 'receita';
  description: string;
  amountCents: number;
  competenceDate: string; // YYYY-MM-DD
  cashDate: Date | null;
  status: 'em_aberto' | 'liquidado';
  categoryId: string;
  accountId: string | null;
  originSource: 'hotmart_sale' | 'lead_paid';
  originHotmartSaleId: string | null;
  originLeadId: string | null;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Venda Hotmart aprovada: a comissão já foi processada/paga pela Hotmart, então
// competência e caixa são o mesmo instante (purchasedAt) — entra já liquidada.
export function mapHotmartSaleToEntry(
  sale: HotmartSaleInput,
  categoryId: string,
  defaultAccountId: string | null,
): RevenueEntryDraft {
  return {
    kind: 'receita',
    description: 'Venda Hotmart (Método SAL)',
    amountCents: sale.commissionCents,
    competenceDate: toDateOnly(sale.purchasedAt),
    cashDate: sale.purchasedAt,
    status: 'liquidado',
    categoryId,
    accountId: defaultAccountId,
    originSource: 'hotmart_sale',
    originHotmartSaleId: sale.id,
    originLeadId: null,
  };
}

// Lead fechado (mentoria/consultoria/assessoria): a data de competência é
// quando o lead ATINGIU o estágio `paid` (via lead_stage_history — a query
// resolve isso e passa aqui já pronto; fallback updatedAt fica a cargo dela).
// cashDate fica nulo — o dinheiro (Pix/cartão) ainda não foi confirmado no
// caixa; o owner liquida manualmente quando recebe.
//
// `valorProposto` é numeric(12,2) — chega como STRING do driver Postgres.
// Number(string) + Math.round evita o erro clássico de arredondamento de
// float ao multiplicar por 100 direto num valor já-float.
export function mapLeadPaidToEntry(
  lead: LeadPaidInput,
  competenceDate: string,
  categoryId: string,
): RevenueEntryDraft | null {
  if (!lead.valorProposto) return null;
  const amountCents = Math.round(Number(lead.valorProposto) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;

  return {
    kind: 'receita',
    description: 'Mentoria/Consultoria (lead fechado)',
    amountCents,
    competenceDate,
    cashDate: null,
    status: 'em_aberto',
    categoryId,
    accountId: null,
    originSource: 'lead_paid',
    originHotmartSaleId: null,
    originLeadId: lead.id,
  };
}
