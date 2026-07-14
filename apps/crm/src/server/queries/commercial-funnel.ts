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

import { and, count, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
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
// America/Sao_Paulo), a corrente inclusa (parcial). Independe do filtro de
// período do funil.
//
// ⚠️ Custo de query é o gargalo aqui. A versão ingênua (chamar
// getCommercialFunnelCounts por semana) faz N×8 idas ao banco — com N=4, são
// 32 round-trips só pra esta seção, em cima das ~20 do resto do dashboard.
// Em paralelo, isso esgotou o pool de 10 conexões (@repo/db/client `max: 10`)
// → "Connection closed"; em sequência, estourou o tempo da serverless
// function → 504 FUNCTION_INVOCATION_TIMEOUT. Ambos são o MESMO sintoma:
// query demais. Aqui colapsamos tudo em 3 queries agrupadas — uma por fonte
// (leads / form_responses / lead_stage_history) — usando `count(*) FILTER
// (WHERE ...)` com os MESMOS limites [from, to) de cada semana. Como os
// predicados são idênticos aos da versão por-semana, os números batem
// exatamente; só o nº de round-trips cai de 32 → 3.

const WEEKLY_STAGE_SLUGS = [
  'qualified',
  'first_contact_sent',
  'meeting_scheduled',
  'meeting_done',
  'proposal_sent',
  'paid',
] as const;

// count(*) FILTER (WHERE expr ∈ [semana_i.from, semana_i.to)) para cada semana,
// como colunas w0..w{n-1}. `sql.raw(w${i})` usa só o índice do loop (nunca
// entrada do usuário) → sem risco de injeção.
function weeklyFilterColumns(ranges: WeekRange[], dateExpr: SQL): SQL {
  return sql.join(
    ranges.map(
      (w, i) =>
        sql`count(*) filter (where ${dateExpr} >= ${w.from.toISOString()}::timestamptz and ${dateExpr} < ${w.to.toISOString()}::timestamptz) as ${sql.raw(
          `w${i}`,
        )}`,
    ),
    sql`, `,
  );
}

function readWeekRow(row: Record<string, unknown> | undefined, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Number(row?.[`w${i}`] ?? 0));
  return out;
}

export async function getWeeklyFunnel(
  weeks = 4,
  now: Date = new Date(),
): Promise<WeeklyFunnelRow[]> {
  const ranges: WeekRange[] = lastNWeeks(weeks, now);
  if (ranges.length === 0) return [];

  // Janela geral = da segunda mais antiga até a segunda seguinte à corrente.
  // As semanas são contíguas e sem sobreposição, então cada linha do banco
  // cai em exatamente um FILTER — a soma dos filtros = total na janela.
  const overallFrom = ranges[ranges.length - 1]!.from.toISOString();
  const overallTo = ranges[0]!.to.toISOString();
  const n = ranges.length;

  const entryExpr = sql`coalesce(${schema.leads.applicationReceivedAt}, ${schema.leads.createdAt})`;

  const [leadsRows, formRows, stageRows] = await Promise.all([
    // 1) leads que entraram, por semana
    db.execute(sql`
      select ${weeklyFilterColumns(ranges, entryExpr)}
      from ${schema.leads}
      where ${schema.leads.deletedAt} is null
        and ${entryExpr} >= ${overallFrom}::timestamptz
        and ${entryExpr} < ${overallTo}::timestamptz
    `) as unknown as Promise<Array<Record<string, unknown>>>,
    // 2) formulários concluídos, por semana
    db.execute(sql`
      select ${weeklyFilterColumns(ranges, sql`${schema.formResponses.concluidoEm}`)}
      from ${schema.formResponses}
      where ${schema.formResponses.parcial} = false
        and ${schema.formResponses.concluidoEm} >= ${overallFrom}::timestamptz
        and ${schema.formResponses.concluidoEm} < ${overallTo}::timestamptz
    `) as unknown as Promise<Array<Record<string, unknown>>>,
    // 3) transições de estágio (qualificado→venda), por slug × semana
    db.execute(sql`
      select ${schema.leadStages.slug} as slug,
        ${weeklyFilterColumns(ranges, sql`${schema.leadStageHistory.changedAt}`)}
      from ${schema.leadStageHistory}
      inner join ${schema.leadStages}
        on ${schema.leadStages.id} = ${schema.leadStageHistory.toStageId}
      where ${inArray(schema.leadStages.slug, [...WEEKLY_STAGE_SLUGS])}
        and ${schema.leadStageHistory.changedAt} >= ${overallFrom}::timestamptz
        and ${schema.leadStageHistory.changedAt} < ${overallTo}::timestamptz
      group by ${schema.leadStages.slug}
    `) as unknown as Promise<Array<Record<string, unknown>>>,
  ]);

  const leadsByWeek = readWeekRow(leadsRows[0], n);
  const formsByWeek = readWeekRow(formRows[0], n);

  const stageByWeek = new Map<string, number[]>();
  for (const row of stageRows) {
    stageByWeek.set(String(row.slug), readWeekRow(row, n));
  }
  const stageAt = (slug: string, i: number): number => stageByWeek.get(slug)?.[i] ?? 0;

  return ranges.map((week, i) => ({
    label: week.label,
    isCurrent: week.isCurrent,
    counts: {
      leadsEntered: leadsByWeek[i] ?? 0,
      formResponses: formsByWeek[i] ?? 0,
      qualifiedReached: stageAt('qualified', i),
      firstContactReached: stageAt('first_contact_sent', i),
      meetingsScheduled: stageAt('meeting_scheduled', i),
      meetingsAttended: stageAt('meeting_done', i),
      proposalsSent: stageAt('proposal_sent', i),
      salesWon: stageAt('paid', i),
    },
  }));
}
