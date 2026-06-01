import { and, avg, count, desc, eq, inArray, max, sql } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { Analyzer } from '@repo/commercial/types';

export type AnalysisListItem = {
  id: string;
  analyzer: string;
  title: string;
  callDate: string;
  status: string;
  overallScore: number | null;
  extractedData: Record<string, unknown> | null;
  leadId: string | null;
  leadName: string | null;
  createdAt: Date;
};

export type AnalysisKpis = {
  total: number;
  avgScore: number | null;
  thisMonth: number;
  topScore: number | null;
  // closer: fechou=true · sdr: agendou=true (ambos em extracted_data)
  closedCount: number | null;
};

export async function listAnalyses(
  analyzer: Analyzer,
  opts: { limit?: number } = {},
): Promise<AnalysisListItem[]> {
  const limit = opts.limit ?? 50;

  const rows = await db
    .select({
      id: schema.commercialAnalyses.id,
      analyzer: schema.commercialAnalyses.analyzer,
      title: schema.commercialAnalyses.title,
      callDate: schema.commercialAnalyses.callDate,
      status: schema.commercialAnalyses.status,
      overallScore: schema.commercialAnalyses.overallScore,
      extractedData: schema.commercialAnalyses.extractedData,
      leadId: schema.commercialAnalyses.leadId,
      leadName: schema.leads.name,
      createdAt: schema.commercialAnalyses.createdAt,
    })
    .from(schema.commercialAnalyses)
    .leftJoin(schema.leads, eq(schema.commercialAnalyses.leadId, schema.leads.id))
    .where(eq(schema.commercialAnalyses.analyzer, analyzer))
    .orderBy(desc(schema.commercialAnalyses.callDate), desc(schema.commercialAnalyses.createdAt))
    .limit(limit);

  // jsonb infere como `unknown`; o shape real é objeto da extração (ou null).
  return rows.map((r) => ({
    ...r,
    extractedData: r.extractedData as Record<string, unknown> | null,
  }));
}

export async function getAnalysisById(id: string) {
  const [row] = await db
    .select({
      id: schema.commercialAnalyses.id,
      analyzer: schema.commercialAnalyses.analyzer,
      title: schema.commercialAnalyses.title,
      callDate: schema.commercialAnalyses.callDate,
      sourceType: schema.commercialAnalyses.sourceType,
      transcript: schema.commercialAnalyses.transcript,
      durationMinutes: schema.commercialAnalyses.durationMinutes,
      overallScore: schema.commercialAnalyses.overallScore,
      scoreBreakdown: schema.commercialAnalyses.scoreBreakdown,
      scoreSummary: schema.commercialAnalyses.scoreSummary,
      extractedData: schema.commercialAnalyses.extractedData,
      status: schema.commercialAnalyses.status,
      errorMessage: schema.commercialAnalyses.errorMessage,
      analyzedBy: schema.commercialAnalyses.analyzedBy,
      leadId: schema.commercialAnalyses.leadId,
      leadName: schema.leads.name,
      createdAt: schema.commercialAnalyses.createdAt,
      updatedAt: schema.commercialAnalyses.updatedAt,
    })
    .from(schema.commercialAnalyses)
    .leftJoin(schema.leads, eq(schema.commercialAnalyses.leadId, schema.leads.id))
    .where(eq(schema.commercialAnalyses.id, id))
    .limit(1);

  return row ?? null;
}

export async function getAnalysisKpis(analyzer: Analyzer): Promise<AnalysisKpis> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [row] = await db
    .select({
      total: count(schema.commercialAnalyses.id),
      avgScore: avg(schema.commercialAnalyses.overallScore),
      topScore: max(schema.commercialAnalyses.overallScore),
      thisMonth: sql<number>`COUNT(*) FILTER (WHERE ${schema.commercialAnalyses.createdAt} >= ${startOfMonth.toISOString()}::timestamptz)::int`,
      // closer conta fechamentos (fechou); sdr conta agendamentos (agendou).
      closedCount: sql<number>`COUNT(*) FILTER (WHERE (${schema.commercialAnalyses.extractedData}->>${
        analyzer === 'closer' ? sql`'fechou'` : sql`'agendou'`
      })::boolean = true AND ${schema.commercialAnalyses.status} = 'concluido')::int`,
    })
    .from(schema.commercialAnalyses)
    .where(
      and(
        eq(schema.commercialAnalyses.analyzer, analyzer),
        eq(schema.commercialAnalyses.status, 'concluido'),
      ),
    );

  return {
    total: row?.total ?? 0,
    avgScore: row?.avgScore ? Math.round(Number(row.avgScore)) : null,
    thisMonth: row?.thisMonth ?? 0,
    topScore: row?.topScore ?? null,
    closedCount: row?.closedCount ?? 0,
  };
}

/** Casa um número (só dígitos) com um lead, tolerando o 9º dígito BR. */
export async function getLeadByWhatsappDigits(digitsOnly: string) {
  const clean = digitsOnly.replace(/\D/g, '');
  if (!clean) return null;

  // Variantes BR: com e sem o 9 após o DDD (cadastro e WhatsApp podem divergir).
  const variants = new Set<string>([clean]);
  if (clean.startsWith('55')) {
    const rest = clean.slice(2);
    if (rest.length === 11 && rest[2] === '9') {
      variants.add('55' + rest.slice(0, 2) + rest.slice(3));
    } else if (rest.length === 10) {
      variants.add('55' + rest.slice(0, 2) + '9' + rest.slice(2));
    }
  }

  const [row] = await db
    .select({ id: schema.leads.id, name: schema.leads.name })
    .from(schema.leads)
    .where(
      and(
        inArray(schema.leads.whatsappDigitsOnly, [...variants]),
        sql`${schema.leads.deletedAt} IS NULL`,
      ),
    )
    .limit(1);

  return row ?? null;
}

// Busca leve de leads para o seletor no form de nova análise.
export async function searchLeadsForSelector(q: string, limit = 8) {
  if (!q.trim()) return [];
  const term = `%${q.trim()}%`;
  return db
    .select({ id: schema.leads.id, name: schema.leads.name, nickname: schema.leads.nickname })
    .from(schema.leads)
    .where(
      and(
        sql`(${schema.leads.name} ILIKE ${term} OR ${schema.leads.nickname} ILIKE ${term})`,
        sql`${schema.leads.deletedAt} IS NULL`,
      ),
    )
    .orderBy(desc(schema.leads.updatedAt))
    .limit(limit);
}
