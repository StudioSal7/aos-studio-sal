import { and, count, eq, gte, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { DateRange } from '@/server/lib/date-range/index';

// Snapshot "agora" do pipeline por estágio. O slug vai junto porque é o
// identificador estável — displayName é editável pelo owner e não pode ser
// usado em filtro de código.
export async function getPipelineCounts() {
  return db
    .select({
      stageId: schema.leads.stageId,
      stageSlug: schema.leadStages.slug,
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
      schema.leadStages.slug,
      schema.leadStages.displayName,
      schema.leadStages.kind,
      schema.leadStages.position,
    )
    .orderBy(schema.leadStages.position);
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

/**
 * Pares (aplicação, primeiro contato) dos leads que já tiveram primeiro
 * contato e têm timestamp de aplicação. Base da métrica "tempo até 1º contato".
 * Legados sem application_received_at ficam de fora (sem início confiável).
 */
export async function getTimeToFirstContact(range?: DateRange) {
  const conditions = [
    isNull(schema.leads.deletedAt),
    isNotNull(schema.leads.applicationReceivedAt),
    isNotNull(schema.leads.firstContactAt),
  ];
  if (range?.from) conditions.push(gte(schema.leads.applicationReceivedAt, range.from));
  if (range?.to) conditions.push(lt(schema.leads.applicationReceivedAt, range.to));

  return db
    .select({
      applicationReceivedAt: schema.leads.applicationReceivedAt,
      firstContactAt: schema.leads.firstContactAt,
    })
    .from(schema.leads)
    .where(and(...conditions));
}
