import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

export async function getKanbanLeads() {
  const stages = await db
    .select()
    .from(schema.leadStages)
    .orderBy(schema.leadStages.position);

  const leads = await db
    .select({
      id: schema.leads.id,
      name: schema.leads.name,
      nickname: schema.leads.nickname,
      email: schema.leads.email,
      whatsappE164: schema.leads.whatsappE164,
      instagramHandle: schema.leads.instagramHandle,
      stageId: schema.leads.stageId,
      nextActionAt: schema.leads.nextActionAt,
      nextActionType: schema.leads.nextActionType,
      sdrId: schema.leads.sdrId,
      closerId: schema.leads.closerId,
      needsManualReview: schema.leads.needsManualReview,
      requiresAttention: schema.leads.requiresAttention,
      marcadoFake: schema.leads.marcadoFake,
      ehClienteAnterior: schema.leads.ehClienteAnterior,
      idadeFaixa: schema.leads.idadeFaixa,
      abordagemPreferida: schema.leads.abordagemPreferida,
      tempoNoNichoFaixa: schema.leads.tempoNoNichoFaixa,
      rendaFaixa: schema.leads.rendaFaixa,
      orcamentoFaixa: schema.leads.orcamentoFaixa,
      profissao: schema.leads.profissao,
      createdAt: schema.leads.createdAt,
      applicationReceivedAt: schema.leads.applicationReceivedAt,
      updatedAt: schema.leads.updatedAt,
      hasUnconfirmedMeeting: sql<boolean>`EXISTS (
        SELECT 1 FROM ${schema.meetings}
        WHERE ${schema.meetings.leadId} = ${schema.leads.id}
          AND ${schema.meetings.needsConfirmation} = TRUE
          AND ${schema.meetings.deletedAt} IS NULL
      )`,
    })
    .from(schema.leads)
    .where(isNull(schema.leads.deletedAt))
    .orderBy(desc(schema.leads.createdAt));

  return { stages, leads };
}

export async function getLeadById(id: string) {
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, id), isNull(schema.leads.deletedAt)))
    .limit(1);
  return lead ?? null;
}

export async function getLeadStageHistory(leadId: string) {
  return db
    .select({
      id: schema.leadStageHistory.id,
      fromStageId: schema.leadStageHistory.fromStageId,
      toStageId: schema.leadStageHistory.toStageId,
      durationInPreviousSeconds: schema.leadStageHistory.durationInPreviousSeconds,
      changedBy: schema.leadStageHistory.changedBy,
      changedAt: schema.leadStageHistory.changedAt,
    })
    .from(schema.leadStageHistory)
    .where(eq(schema.leadStageHistory.leadId, leadId))
    .orderBy(desc(schema.leadStageHistory.changedAt));
}

export async function getHotLeads() {
  const now = new Date();
  const limit48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  return db
    .select({
      id: schema.leads.id,
      name: schema.leads.name,
      nickname: schema.leads.nickname,
      nextActionAt: schema.leads.nextActionAt,
      nextActionType: schema.leads.nextActionType,
      nextActionNotes: schema.leads.nextActionNotes,
      stageId: schema.leads.stageId,
    })
    .from(schema.leads)
    .where(
      and(
        isNull(schema.leads.deletedAt),
        lte(schema.leads.nextActionAt, limit48h),
        gte(schema.leads.nextActionAt, now),
      ),
    )
    .orderBy(schema.leads.nextActionAt);
}

export async function getManualReviewLeads() {
  return db
    .select({
      id: schema.leads.id,
      name: schema.leads.name,
      nickname: schema.leads.nickname,
      email: schema.leads.email,
      whatsappE164: schema.leads.whatsappE164,
      manualReviewReason: schema.leads.manualReviewReason,
      stageId: schema.leads.stageId,
      createdAt: schema.leads.createdAt,
    })
    .from(schema.leads)
    .where(and(isNull(schema.leads.deletedAt), eq(schema.leads.needsManualReview, true)))
    .orderBy(schema.leads.createdAt);
}

export async function getAllStages() {
  return db.select().from(schema.leadStages).orderBy(schema.leadStages.position);
}

export async function getAllLossReasons() {
  return db
    .select()
    .from(schema.leadLossReasons)
    .where(eq(schema.leadLossReasons.active, true))
    .orderBy(schema.leadLossReasons.displayName);
}
