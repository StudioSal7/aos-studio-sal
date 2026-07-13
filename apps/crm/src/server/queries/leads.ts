import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { RespondiAddress, RespondiAnswer, RespondiPayload } from '@/server/lib/respondi-payload-mapper/index';

function formatRespondiAnswer(answer: RespondiAnswer): string | null {
  if (answer == null) return null;
  if (Array.isArray(answer)) {
    return answer.length > 0 ? answer.join(', ') : null;
  }
  if (typeof answer === 'string') {
    return answer.trim().length > 0 ? answer : null;
  }
  // RespondiAddress — junta os campos preenchidos numa linha legível.
  const addr = answer as RespondiAddress;
  const parts = [addr.street, addr.number, addr.addressComp, addr.neighborhood, addr.city, addr.state, addr.cep, addr.country]
    .filter((p): p is string => !!p && p.trim().length > 0);
  return parts.length > 0 ? parts.join(', ') : null;
}

// Respostas cruas do webhook Respondi (payload_raw em lead_intake_log), para
// leads que NÃO vieram pelo formulário self-hosted (esses não têm form_responses).
// Preserva o texto literal da pergunta (question_title) — inclusive perguntas
// sem mapeamento para coluna do lead.
export async function getLeadRespondiRawAnswers(leadId: string) {
  const [entry] = await db
    .select({
      payloadRaw: schema.leadIntakeLog.payloadRaw,
      receivedAt: schema.leadIntakeLog.receivedAt,
    })
    .from(schema.leadIntakeLog)
    .where(
      and(
        eq(schema.leadIntakeLog.leadId, leadId),
        eq(schema.leadIntakeLog.source, 'respondi_webhook'),
      ),
    )
    .orderBy(desc(schema.leadIntakeLog.receivedAt))
    .limit(1);

  if (!entry?.payloadRaw) return null;

  const payload = entry.payloadRaw as unknown as RespondiPayload;
  const rawAnswers = payload?.respondent?.raw_answers;
  if (!Array.isArray(rawAnswers) || rawAnswers.length === 0) return null;

  const answers = rawAnswers
    .map((r) => ({
      title: r.question?.question_title ?? null,
      value: formatRespondiAnswer(r.answer),
    }))
    .filter((a): a is { title: string; value: string } => !!a.title && !!a.value);

  if (answers.length === 0) return null;

  return {
    receivedAt: entry.receivedAt,
    answers,
  };
}

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
