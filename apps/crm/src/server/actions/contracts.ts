'use server';

// Server actions do contrato de fechamento. Gerar contrato: qualquer papel
// autenticado (mesmo padrão de updateLeadStageAction — closer/sdr fecham
// lead no dia a dia). Upload de template: owner-only (mesmo padrão de
// products.ts/forms.ts).

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { ProductTipo } from '@repo/db/schema';
import { requireAuth, requireRole } from '@/server/auth';
import { uploadContractTemplate, CONTRACT_TIPOS } from '@/server/lib/contract-storage';
import type { ContractCollectedData } from '@/server/lib/contract-data-builder';
import type { ActionResult } from './leads';

const ADMIN_CONTRATOS_PATH = '/admin/contratos';

export type GenerateContractInput = {
  leadId: string;
  coletado: ContractCollectedData;
};

export async function generateContractAction(
  input: GenerateContractInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAuth();

  const [lead] = await db
    .select({
      id: schema.leads.id,
      produtoFechadoId: schema.leads.produtoFechadoId,
      stageSlug: schema.leadStages.slug,
    })
    .from(schema.leads)
    .innerJoin(schema.leadStages, eq(schema.leads.stageId, schema.leadStages.id))
    .where(eq(schema.leads.id, input.leadId))
    .limit(1);

  if (!lead) return { ok: false, error: 'lead_not_found' };
  // Mesma trava do stage-transition-validator: só existe contrato pra lead pago.
  if (lead.stageSlug !== 'paid') return { ok: false, error: 'lead_not_paid' };
  if (!lead.produtoFechadoId) return { ok: false, error: 'produto_nao_vinculado' };

  const [product] = await db
    .select({ tipo: schema.products.tipo })
    .from(schema.products)
    .where(eq(schema.products.id, lead.produtoFechadoId))
    .limit(1);

  if (!product?.tipo) return { ok: false, error: 'produto_sem_tipo' };

  const [contract] = await db
    .insert(schema.leadContracts)
    .values({
      leadId: input.leadId,
      produtoId: lead.produtoFechadoId,
      tipo: product.tipo,
      dados: input.coletado,
      createdBy: auth.userId,
    })
    .returning({ id: schema.leadContracts.id });

  if (!contract) return { ok: false, error: 'Falha ao gerar contrato.' };

  revalidatePath(`/leads/${input.leadId}`);
  return { ok: true, data: { id: contract.id } };
}

export async function uploadContractTemplateAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAuth();
  requireRole(auth, 'owner');

  const tipo = formData.get('tipo');
  const file = formData.get('file');

  if (typeof tipo !== 'string' || !CONTRACT_TIPOS.includes(tipo as ProductTipo)) {
    return { ok: false, error: 'Tipo de produto inválido.' };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Arquivo obrigatório.' };
  }
  if (!file.name.toLowerCase().endsWith('.docx')) {
    return { ok: false, error: 'Só arquivos .docx são aceitos.' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadContractTemplate(tipo as ProductTipo, buffer);

  revalidatePath(ADMIN_CONTRATOS_PATH);
  return { ok: true };
}
