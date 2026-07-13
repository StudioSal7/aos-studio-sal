// Funil de vendas comercial (dashboard): conta, por período, as etapas que o
// CRM já coleta hoje. Posts feitos e visualizações geradas NÃO têm fonte de
// dados (dependem de Meta Ads/GA4 — fase posterior) e não entram aqui; a UI
// as trata com a tag "em manutenção".

import { and, count, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { DateRange } from '@/server/lib/date-range/index';

export interface CommercialFunnelCounts {
  leadsEntered: number;
  formResponses: number;
  meetingsScheduled: number;
  meetingsAttended: number;
  proposalsSent: number;
  salesWon: number;
}

// Leads que entraram no período (application_received_at, com fallback pra
// created_at nos leads legados que não têm esse campo preenchido).
export async function getLeadsEnteredCount(range: DateRange): Promise<number> {
  const entryExpr = sql`coalesce(${schema.leads.applicationReceivedAt}, ${schema.leads.createdAt})`;
  const conditions: SQL[] = [isNull(schema.leads.deletedAt)];
  if (range.from) conditions.push(sql`${entryExpr} >= ${range.from.toISOString()}::timestamptz`);
  if (range.to) conditions.push(sql`${entryExpr} < ${range.to.toISOString()}::timestamptz`);

  const [row] = await db
    .select({ value: count() })
    .from(schema.leads)
    .where(and(...conditions));
  return Number(row?.value ?? 0);
}

// Formulários enviados no período (form_responses completas, não parciais).
export async function getFormResponsesCount(range: DateRange): Promise<number> {
  const conditions: SQL[] = [eq(schema.formResponses.parcial, false)];
  if (range.from) {
    conditions.push(sql`${schema.formResponses.concluidoEm} >= ${range.from.toISOString()}::timestamptz`);
  }
  if (range.to) {
    conditions.push(sql`${schema.formResponses.concluidoEm} < ${range.to.toISOString()}::timestamptz`);
  }

  const [row] = await db
    .select({ value: count() })
    .from(schema.formResponses)
    .where(and(...conditions));
  return Number(row?.value ?? 0);
}

// Reuniões agendadas no período — meetings com status ativo (exclui
// cancelada/não_realizada), filtradas pela data da reunião (scheduled_at).
export async function getMeetingsScheduledCount(range: DateRange): Promise<number> {
  const conditions: SQL[] = [
    inArray(schema.meetings.status, ['agendada', 'realizada', 'reagendada']),
  ];
  if (range.from) conditions.push(sql`${schema.meetings.scheduledAt} >= ${range.from.toISOString()}::timestamptz`);
  if (range.to) conditions.push(sql`${schema.meetings.scheduledAt} < ${range.to.toISOString()}::timestamptz`);

  const [row] = await db
    .select({ value: count() })
    .from(schema.meetings)
    .where(and(...conditions));
  return Number(row?.value ?? 0);
}

// Reuniões comparecidas no período — quando a reunião de fato ACONTECEU
// (meetings.scheduled_at) e foi marcada como realizada.
export async function getMeetingsAttendedCount(range: DateRange): Promise<number> {
  const conditions: SQL[] = [eq(schema.meetings.status, 'realizada')];
  if (range.from) conditions.push(sql`${schema.meetings.scheduledAt} >= ${range.from.toISOString()}::timestamptz`);
  if (range.to) conditions.push(sql`${schema.meetings.scheduledAt} < ${range.to.toISOString()}::timestamptz`);

  const [row] = await db
    .select({ value: count() })
    .from(schema.meetings)
    .where(and(...conditions));
  return Number(row?.value ?? 0);
}

// Leads que atingiram um estágio específico no período, contados pelas
// transições para esse estágio em lead_stage_history.
async function getLeadsReachedStageCount(stageSlug: string, range: DateRange): Promise<number> {
  const [stage] = await db
    .select({ id: schema.leadStages.id })
    .from(schema.leadStages)
    .where(eq(schema.leadStages.slug, stageSlug))
    .limit(1);
  if (!stage) return 0;

  const conditions: SQL[] = [eq(schema.leadStageHistory.toStageId, stage.id)];
  if (range.from) {
    conditions.push(sql`${schema.leadStageHistory.changedAt} >= ${range.from.toISOString()}::timestamptz`);
  }
  if (range.to) {
    conditions.push(sql`${schema.leadStageHistory.changedAt} < ${range.to.toISOString()}::timestamptz`);
  }

  const [row] = await db
    .select({ value: count() })
    .from(schema.leadStageHistory)
    .where(and(...conditions));
  return Number(row?.value ?? 0);
}

export async function getProposalsSentCount(range: DateRange): Promise<number> {
  return getLeadsReachedStageCount('proposal_sent', range);
}

export async function getSalesWonCount(range: DateRange): Promise<number> {
  return getLeadsReachedStageCount('paid', range);
}

export async function getCommercialFunnelCounts(range: DateRange): Promise<CommercialFunnelCounts> {
  const [leadsEntered, formResponses, meetingsScheduled, meetingsAttended, proposalsSent, salesWon] =
    await Promise.all([
      getLeadsEnteredCount(range),
      getFormResponsesCount(range),
      getMeetingsScheduledCount(range),
      getMeetingsAttendedCount(range),
      getProposalsSentCount(range),
      getSalesWonCount(range),
    ]);

  return { leadsEntered, formResponses, meetingsScheduled, meetingsAttended, proposalsSent, salesWon };
}
