// Funil de vendas comercial (dashboard): conta, por período, as etapas que o
// CRM já coleta hoje. Posts feitos e visualizações geradas NÃO têm fonte de
// dados (dependem de Meta Ads/GA4 — fase posterior) e não entram aqui; a UI
// as trata com a tag "em manutenção".
//
// Reunião agendada/comparecida vêm de lead_stage_history (movimento do card no
// kanban para os estágios meeting_scheduled/meeting_done) — mesma fonte de
// proposta/venda. Não usamos a tabela `meetings` aqui: o time trabalha no
// kanban e arrastar o card É o evento; a tabela `meetings` só é populada pelo
// formulário na tela do lead, que a operação nem sempre usa.

import { and, count, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { DateRange } from '@/server/lib/date-range/index';
import { lastNWeeks, type WeekRange } from '@/server/lib/week-range/index';

export interface CommercialFunnelCounts {
  leadsEntered: number;
  formResponses: number;
  qualifiedReached: number;
  firstContactReached: number;
  meetingsScheduled: number;
  meetingsAttended: number;
  proposalsSent: number;
  salesWon: number;
}

export interface WeeklyFunnelRow {
  label: string;
  isCurrent: boolean;
  counts: CommercialFunnelCounts;
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

// Reuniões agendadas no período — leads movidos para o estágio
// `meeting_scheduled` no kanban (transição em lead_stage_history).
export async function getMeetingsScheduledCount(range: DateRange): Promise<number> {
  return getLeadsReachedStageCount('meeting_scheduled', range);
}

// Reuniões comparecidas no período — leads movidos para o estágio
// `meeting_done` no kanban (transição em lead_stage_history).
export async function getMeetingsAttendedCount(range: DateRange): Promise<number> {
  return getLeadsReachedStageCount('meeting_done', range);
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

export async function getQualifiedReachedCount(range: DateRange): Promise<number> {
  return getLeadsReachedStageCount('qualified', range);
}

export async function getFirstContactReachedCount(range: DateRange): Promise<number> {
  return getLeadsReachedStageCount('first_contact_sent', range);
}

export async function getProposalsSentCount(range: DateRange): Promise<number> {
  return getLeadsReachedStageCount('proposal_sent', range);
}

export async function getSalesWonCount(range: DateRange): Promise<number> {
  return getLeadsReachedStageCount('paid', range);
}

export async function getCommercialFunnelCounts(range: DateRange): Promise<CommercialFunnelCounts> {
  const [
    leadsEntered,
    formResponses,
    qualifiedReached,
    firstContactReached,
    meetingsScheduled,
    meetingsAttended,
    proposalsSent,
    salesWon,
  ] = await Promise.all([
    getLeadsEnteredCount(range),
    getFormResponsesCount(range),
    getQualifiedReachedCount(range),
    getFirstContactReachedCount(range),
    getMeetingsScheduledCount(range),
    getMeetingsAttendedCount(range),
    getProposalsSentCount(range),
    getSalesWonCount(range),
  ]);

  return {
    leadsEntered,
    formResponses,
    qualifiedReached,
    firstContactReached,
    meetingsScheduled,
    meetingsAttended,
    proposalsSent,
    salesWon,
  };
}

// Evolução semanal: as N semanas de calendário mais recentes (segunda→domingo,
// America/Sao_Paulo), a corrente inclusa (parcial). Reusa a mesma lógica de
// contagem por semana. Independe do filtro de período do funil.
//
// Semanas em SEQUÊNCIA, não em paralelo: cada getCommercialFunnelCounts já
// dispara ~8 queries concorrentes; 4 semanas em paralelo somariam ~32 queries
// simultâneas contra o pool de 10 conexões do client (@repo/db/client,
// `max: 10`), empilhadas em cima do resto das queries do dashboard —
// exauriu o pool em produção ("Uncaught Error: Connection closed" no
// console). Sequencial mantém o pico de concorrência igual ao de uma única
// chamada de funil; a latência extra é aceitável num dashboard interno.
export async function getWeeklyFunnel(
  weeks = 4,
  now: Date = new Date(),
): Promise<WeeklyFunnelRow[]> {
  const ranges: WeekRange[] = lastNWeeks(weeks, now);
  const rows: WeeklyFunnelRow[] = [];
  for (const week of ranges) {
    const counts = await getCommercialFunnelCounts({ from: week.from, to: week.to });
    rows.push({ label: week.label, isCurrent: week.isCurrent, counts });
  }
  return rows;
}
