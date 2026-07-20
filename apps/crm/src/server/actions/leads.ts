'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { requireAuth } from '@/server/auth';
import { validateStageTransition } from '@/server/lib/stage-transition-validator/index';
import { reachesFirstContact } from '@/server/lib/first-contact-urgency';
import { writeFieldAudit, writeStageHistory } from '@/server/audit-writer';

// ---- Stage transition ----

type UpdateStageInput = {
  leadId: string;
  targetStageId: string;
  motivoPerdaId?: string;
  valorProposto?: string;
  formaPagamentoNegociada?: string;
  produtoFechadoId?: string;
};

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function updateLeadStageAction(
  input: UpdateStageInput,
): Promise<ActionResult> {
  const auth = await requireAuth();

  const [lead] = await db
    .select({
      id: schema.leads.id,
      stageId: schema.leads.stageId,
      updatedAt: schema.leads.updatedAt,
      firstContactAt: schema.leads.firstContactAt,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), isNull(schema.leads.deletedAt)))
    .limit(1);

  if (!lead) return { ok: false, error: 'lead_not_found' };

  const [targetStage] = await db
    .select({ id: schema.leadStages.id, slug: schema.leadStages.slug, kind: schema.leadStages.kind })
    .from(schema.leadStages)
    .where(eq(schema.leadStages.id, input.targetStageId))
    .limit(1);

  if (!targetStage) return { ok: false, error: 'stage_not_found' };

  const validation = validateStageTransition(targetStage.kind, targetStage.slug, {
    motivoPerdaId: input.motivoPerdaId,
    valorProposto: input.valorProposto,
    formaPagamentoNegociada: input.formaPagamentoNegociada,
    produtoFechadoId: input.produtoFechadoId,
  });

  if (!validation.valid) {
    return { ok: false, error: validation.reason };
  }

  const now = new Date();
  const durationSec = lead.updatedAt
    ? Math.round((now.getTime() - lead.updatedAt.getTime()) / 1000)
    : null;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.leads)
      .set({
        stageId: input.targetStageId,
        motivoPerdaId: input.motivoPerdaId ?? undefined,
        valorProposto: input.valorProposto ?? undefined,
        formaPagamentoNegociada: input.formaPagamentoNegociada ?? undefined,
        produtoFechadoId: input.produtoFechadoId ?? undefined,
        firstContactAt:
          lead.firstContactAt == null && reachesFirstContact(targetStage.slug)
            ? now
            : undefined,
        updatedAt: now,
      })
      .where(eq(schema.leads.id, input.leadId));

    await writeStageHistory(tx, {
      leadId: input.leadId,
      fromStageId: lead.stageId,
      toStageId: input.targetStageId,
      durationInPreviousSeconds: durationSec,
      changedBy: auth.userId,
    });

    await writeFieldAudit(tx, {
      leadId: input.leadId,
      changes: {
        ...(input.motivoPerdaId !== undefined && {
          motivoPerdaId: { from: null, to: input.motivoPerdaId },
        }),
        ...(input.valorProposto !== undefined && {
          valorProposto: { from: null, to: input.valorProposto },
        }),
        ...(input.formaPagamentoNegociada !== undefined && {
          formaPagamentoNegociada: { from: null, to: input.formaPagamentoNegociada },
        }),
        ...(input.produtoFechadoId !== undefined && {
          produtoFechadoId: { from: null, to: input.produtoFechadoId },
        }),
      },
      changedBy: auth.userId,
    });
  });

  revalidatePath('/');
  return { ok: true };
}

// ---- Assign SDR/Closer ----

export async function assignResponsavelAction(
  leadId: string,
  field: 'sdrId' | 'closerId',
  userId: string | null,
): Promise<ActionResult> {
  const auth = await requireAuth();

  const [lead] = await db
    .select({ id: schema.leads.id, sdrId: schema.leads.sdrId, closerId: schema.leads.closerId })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), isNull(schema.leads.deletedAt)))
    .limit(1);

  if (!lead) return { ok: false, error: 'lead_not_found' };

  const previousValue = field === 'sdrId' ? lead.sdrId : lead.closerId;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.leads)
      .set({ [field]: userId, updatedAt: new Date() })
      .where(eq(schema.leads.id, leadId));

    await writeFieldAudit(tx, {
      leadId,
      changes: { [field]: { from: previousValue, to: userId } },
      changedBy: auth.userId,
    });
  });

  revalidatePath('/');
  return { ok: true };
}

// ---- Update lead fields (notes, contact info, qualification) ----

type UpdateLeadFieldsInput = {
  leadId: string;
  notes?: string;
  nickname?: string;
  instagramHandle?: string;
  profissao?: string;
  rendaFaixa?: string;
  orcamentoFaixa?: string;
  ehClienteAnterior?: boolean;
  needsManualReview?: boolean;
};

export async function updateLeadFieldsAction(
  input: UpdateLeadFieldsInput,
): Promise<ActionResult> {
  await requireAuth();

  const { leadId, ...fields } = input;

  await db
    .update(schema.leads)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(schema.leads.id, leadId), isNull(schema.leads.deletedAt)));

  revalidatePath('/');
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

// ---- Soft delete (owner only) ----

export async function softDeleteLeadAction(leadId: string): Promise<ActionResult> {
  const auth = await requireAuth();

  if (auth.role !== 'owner') {
    return { ok: false, error: 'forbidden' };
  }

  const [lead] = await db
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), isNull(schema.leads.deletedAt)))
    .limit(1);

  if (!lead) return { ok: false, error: 'lead_not_found' };

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(schema.leads)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(schema.leads.id, leadId));

    await writeFieldAudit(tx, {
      leadId,
      changes: { deletedAt: { from: null, to: now.toISOString() } },
      changedBy: auth.userId,
    });
  });

  revalidatePath('/');
  return { ok: true };
}
