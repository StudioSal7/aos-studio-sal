import { avg, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

export async function getPipelineCounts() {
  return db
    .select({
      stageId: schema.leads.stageId,
      stageDisplayName: schema.leadStages.displayName,
      stageKind: schema.leadStages.kind,
      stagePosition: schema.leadStages.position,
      count: count(schema.leads.id),
    })
    .from(schema.leads)
    .leftJoin(schema.leadStages, eq(schema.leads.stageId, schema.leadStages.id))
    .where(isNull(schema.leads.deletedAt))
    .groupBy(
      schema.leads.stageId,
      schema.leadStages.displayName,
      schema.leadStages.kind,
      schema.leadStages.position,
    )
    .orderBy(schema.leadStages.position);
}

export async function getAvgTimePerStage() {
  return db
    .select({
      toStageId: schema.leadStageHistory.toStageId,
      stageDisplayName: schema.leadStages.displayName,
      avgDurationSeconds: avg(schema.leadStageHistory.durationInPreviousSeconds),
    })
    .from(schema.leadStageHistory)
    .leftJoin(schema.leadStages, eq(schema.leadStageHistory.toStageId, schema.leadStages.id))
    .where(sql`${schema.leadStageHistory.durationInPreviousSeconds} IS NOT NULL`)
    .groupBy(schema.leadStageHistory.toStageId, schema.leadStages.displayName, schema.leadStages.position)
    .orderBy(schema.leadStages.position);
}

export async function getRecentActivity(limit = 20) {
  return db
    .select({
      id: schema.leadStageHistory.id,
      leadId: schema.leadStageHistory.leadId,
      leadName: schema.leads.name,
      leadNickname: schema.leads.nickname,
      fromStageId: schema.leadStageHistory.fromStageId,
      toStageId: schema.leadStageHistory.toStageId,
      fromStageName: sql<string>`from_stage.display_name`,
      toStageName: sql<string>`to_stage.display_name`,
      changedAt: schema.leadStageHistory.changedAt,
    })
    .from(schema.leadStageHistory)
    .leftJoin(schema.leads, eq(schema.leadStageHistory.leadId, schema.leads.id))
    .leftJoin(
      sql`lead_stages as from_stage`,
      sql`${schema.leadStageHistory.fromStageId} = from_stage.id`,
    )
    .leftJoin(
      sql`lead_stages as to_stage`,
      sql`${schema.leadStageHistory.toStageId} = to_stage.id`,
    )
    .where(isNull(schema.leads.deletedAt))
    .orderBy(desc(schema.leadStageHistory.changedAt))
    .limit(limit);
}

export async function getDataQuality() {
  const [result] = await db
    .select({
      total: count(schema.leads.id),
      comEmail: sql<number>`COUNT(${schema.leads.email})::int`,
      comWhatsapp: sql<number>`COUNT(${schema.leads.whatsappE164})::int`,
      comInstagram: sql<number>`COUNT(${schema.leads.instagramHandle})::int`,
      comPontuacao: sql<number>`COUNT(${schema.leads.pontuacao})::int`,
      comRenda: sql<number>`COUNT(${schema.leads.rendaFaixa})::int`,
      comOrcamento: sql<number>`COUNT(${schema.leads.orcamentoFaixa})::int`,
      comIdade: sql<number>`COUNT(${schema.leads.idadeFaixa})::int`,
    })
    .from(schema.leads)
    .where(isNull(schema.leads.deletedAt));
  return (
    result ?? {
      total: 0,
      comEmail: 0,
      comWhatsapp: 0,
      comInstagram: 0,
      comPontuacao: 0,
      comRenda: 0,
      comOrcamento: 0,
      comIdade: 0,
    }
  );
}

// Volume mensal com breakdown por kind (open/won/lost).
export async function getLeadsByMonth() {
  return db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${schema.leads.createdAt}), 'YYYY-MM')`,
      stageKind: schema.leadStages.kind,
      count: count(schema.leads.id),
    })
    .from(schema.leads)
    .leftJoin(schema.leadStages, eq(schema.leads.stageId, schema.leadStages.id))
    .where(isNull(schema.leads.deletedAt))
    .groupBy(
      sql`date_trunc('month', ${schema.leads.createdAt})`,
      schema.leadStages.kind,
    )
    .orderBy(sql`date_trunc('month', ${schema.leads.createdAt})`);
}

// Distribuição por renda (texto bruto).
export async function getLeadsByRenda() {
  return db
    .select({
      renda: schema.leads.rendaFaixa,
      count: count(schema.leads.id),
    })
    .from(schema.leads)
    .where(isNull(schema.leads.deletedAt))
    .groupBy(schema.leads.rendaFaixa)
    .orderBy(desc(count(schema.leads.id)));
}

// Distribuição por orçamento (texto bruto).
export async function getLeadsByOrcamento() {
  return db
    .select({
      orcamento: schema.leads.orcamentoFaixa,
      count: count(schema.leads.id),
    })
    .from(schema.leads)
    .where(isNull(schema.leads.deletedAt))
    .groupBy(schema.leads.orcamentoFaixa)
    .orderBy(desc(count(schema.leads.id)));
}

// Distribuição por idade (enum).
export async function getLeadsByIdade() {
  return db
    .select({
      idade: schema.leads.idadeFaixa,
      count: count(schema.leads.id),
    })
    .from(schema.leads)
    .where(isNull(schema.leads.deletedAt))
    .groupBy(schema.leads.idadeFaixa)
    .orderBy(schema.leads.idadeFaixa);
}

// Pontuação x engajamento: bucketed score com % engajado.
// Engajado = stage_kind != 'lost' AND stage.slug != 'application_received'
export async function getPontuacaoVsEngajamento() {
  return db
    .select({
      bucket: sql<string>`CASE
        WHEN ${schema.leads.pontuacao} BETWEEN 0 AND 5 THEN '0-5'
        WHEN ${schema.leads.pontuacao} BETWEEN 6 AND 8 THEN '6-8'
        WHEN ${schema.leads.pontuacao} BETWEEN 9 AND 11 THEN '9-11'
        WHEN ${schema.leads.pontuacao} BETWEEN 12 AND 14 THEN '12-14'
        WHEN ${schema.leads.pontuacao} BETWEEN 15 AND 17 THEN '15-17'
        WHEN ${schema.leads.pontuacao} >= 18 THEN '18+'
      END`,
      total: count(schema.leads.id),
      engajado: sql<number>`COUNT(*) FILTER (
        WHERE ${schema.leadStages.kind} != 'lost'
        AND ${schema.leadStages.slug} != 'application_received'
      )::int`,
    })
    .from(schema.leads)
    .leftJoin(schema.leadStages, eq(schema.leads.stageId, schema.leadStages.id))
    .where(sql`${schema.leads.pontuacao} IS NOT NULL AND ${schema.leads.deletedAt} IS NULL`)
    .groupBy(sql`CASE
      WHEN ${schema.leads.pontuacao} BETWEEN 0 AND 5 THEN '0-5'
      WHEN ${schema.leads.pontuacao} BETWEEN 6 AND 8 THEN '6-8'
      WHEN ${schema.leads.pontuacao} BETWEEN 9 AND 11 THEN '9-11'
      WHEN ${schema.leads.pontuacao} BETWEEN 12 AND 14 THEN '12-14'
      WHEN ${schema.leads.pontuacao} BETWEEN 15 AND 17 THEN '15-17'
      WHEN ${schema.leads.pontuacao} >= 18 THEN '18+'
    END`)
    .orderBy(sql`MIN(${schema.leads.pontuacao})`);
}

// Conversão por fonte: stage_kind x source.
export async function getConversaoPorFonte() {
  return db
    .select({
      sourceName: sql<string>`COALESCE(${schema.leadSources.displayName}, 'Sem fonte')`,
      stageKind: schema.leadStages.kind,
      stageSlug: schema.leadStages.slug,
      count: count(schema.leads.id),
    })
    .from(schema.leads)
    .leftJoin(schema.leadSources, eq(schema.leads.leadSourceId, schema.leadSources.id))
    .leftJoin(schema.leadStages, eq(schema.leads.stageId, schema.leadStages.id))
    .where(isNull(schema.leads.deletedAt))
    .groupBy(
      schema.leadSources.displayName,
      schema.leadStages.kind,
      schema.leadStages.slug,
    );
}

export async function getTotalLeadsBySource() {
  return db
    .select({
      sourceId: schema.leads.leadSourceId,
      sourceName: schema.leadSources.displayName,
      count: count(schema.leads.id),
    })
    .from(schema.leads)
    .leftJoin(schema.leadSources, eq(schema.leads.leadSourceId, schema.leadSources.id))
    .where(isNull(schema.leads.deletedAt))
    .groupBy(schema.leads.leadSourceId, schema.leadSources.displayName)
    .orderBy(desc(count(schema.leads.id)));
}
