import { desc, eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { ProductTipo } from '@repo/db/schema';
import { listContractTemplatesStatus, type ContractTemplateStatus } from '@/server/lib/contract-storage';
import type { ContractCollectedData } from '@/server/lib/contract-data-builder';

export type LeadContractListItem = {
  id: string;
  tipo: ProductTipo;
  createdAt: Date;
};

/** Lista os contratos já gerados de um lead, mais recente primeiro — pra aba comercial. */
export async function getContractsForLead(leadId: string): Promise<LeadContractListItem[]> {
  return db
    .select({
      id: schema.leadContracts.id,
      tipo: schema.leadContracts.tipo,
      createdAt: schema.leadContracts.createdAt,
    })
    .from(schema.leadContracts)
    .where(eq(schema.leadContracts.leadId, leadId))
    .orderBy(desc(schema.leadContracts.createdAt));
}

export type ContractForDownload = {
  contract: { id: string; tipo: ProductTipo; dados: ContractCollectedData };
  lead: {
    id: string;
    name: string | null;
    nickname: string | null;
    email: string | null;
    whatsappE164: string | null;
    valorProposto: string | null;
    formaPagamentoNegociada: string | null;
  };
  product: { displayName: string } | null;
};

/** Tudo que a rota de download precisa num único lugar — contrato + lead (sempre atual) + produto. */
export async function getContractForDownload(contractId: string): Promise<ContractForDownload | null> {
  const [row] = await db
    .select({
      contractId: schema.leadContracts.id,
      tipo: schema.leadContracts.tipo,
      dados: schema.leadContracts.dados,
      leadId: schema.leadContracts.leadId,
      produtoId: schema.leadContracts.produtoId,
    })
    .from(schema.leadContracts)
    .where(eq(schema.leadContracts.id, contractId))
    .limit(1);

  if (!row) return null;

  const [lead] = await db
    .select({
      id: schema.leads.id,
      name: schema.leads.name,
      nickname: schema.leads.nickname,
      email: schema.leads.email,
      whatsappE164: schema.leads.whatsappE164,
      valorProposto: schema.leads.valorProposto,
      formaPagamentoNegociada: schema.leads.formaPagamentoNegociada,
    })
    .from(schema.leads)
    .where(eq(schema.leads.id, row.leadId))
    .limit(1);

  if (!lead) return null;

  let product: { displayName: string } | null = null;
  if (row.produtoId) {
    const [p] = await db
      .select({ displayName: schema.products.displayName })
      .from(schema.products)
      .where(eq(schema.products.id, row.produtoId))
      .limit(1);
    product = p ?? null;
  }

  return {
    contract: {
      id: row.contractId,
      tipo: row.tipo,
      dados: (row.dados ?? {}) as ContractCollectedData,
    },
    lead,
    product,
  };
}

/** Status dos 2 templates .docx (mentoria/infoproduto) — /admin/contratos. */
export async function listContractTemplates(): Promise<ContractTemplateStatus[]> {
  return listContractTemplatesStatus();
}
