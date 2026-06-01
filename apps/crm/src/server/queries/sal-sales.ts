import { and, count, desc, eq, gte, sql, sum } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

export const SAL_PRODUCT_CODE = '6721435';

export type SalesRange = '7d' | '30d' | '90d' | 'all';

const RANGE_DAYS: Record<Exclude<SalesRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function cutoffDate(range: SalesRange): Date | null {
  if (range === 'all') return null;
  const days = RANGE_DAYS[range];
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function baseWhere(range: SalesRange) {
  const cutoff = cutoffDate(range);
  if (cutoff) {
    return and(
      eq(schema.salSales.productCode, SAL_PRODUCT_CODE),
      gte(schema.salSales.purchasedAt, cutoff),
    );
  }
  return eq(schema.salSales.productCode, SAL_PRODUCT_CODE);
}

// KPIs: agregação única com FILTER (...) por status/trafficType.
export async function getSalesKpis(range: SalesRange) {
  const [row] = await db
    .select({
      totalCount: count(schema.salSales.id),
      approvedCount: sql<number>`COUNT(*) FILTER (WHERE ${schema.salSales.status} = 'approved')::int`,
      testCount: sql<number>`COUNT(*) FILTER (WHERE ${schema.salSales.status} = 'test')::int`,
      refundedCount: sql<number>`COUNT(*) FILTER (WHERE ${schema.salSales.status} = 'refunded')::int`,
      revenueCents: sql<number>`COALESCE(SUM(${schema.salSales.commissionCents}) FILTER (WHERE ${schema.salSales.status} = 'approved'), 0)::bigint`,
      paidCount: sql<number>`COUNT(*) FILTER (WHERE ${schema.salSales.status} = 'approved' AND ${schema.salSales.trafficType} = 'paid')::int`,
      organicCount: sql<number>`COUNT(*) FILTER (WHERE ${schema.salSales.status} = 'approved' AND ${schema.salSales.trafficType} = 'organic')::int`,
      unknownCount: sql<number>`COUNT(*) FILTER (WHERE ${schema.salSales.status} = 'approved' AND ${schema.salSales.trafficType} = 'unknown')::int`,
    })
    .from(schema.salSales)
    .where(baseWhere(range));

  return (
    row ?? {
      totalCount: 0,
      approvedCount: 0,
      testCount: 0,
      refundedCount: 0,
      revenueCents: 0,
      paidCount: 0,
      organicCount: 0,
      unknownCount: 0,
    }
  );
}

// Série temporal de vendas aprovadas, separada por traffic_type.
// Granularidade: day (7/30d), week (90d), month (all).
export async function getSalesByPeriod(range: SalesRange) {
  const trunc = range === 'all' ? 'month' : range === '90d' ? 'week' : 'day';
  // trunc precisa ser inlinado (sql.raw) para que SELECT e GROUP BY produzam
  // a mesma expressão SQL — se for parametrizado, vira $1 e $2 e o Postgres
  // não consegue equiparar.
  const truncLit = sql.raw(`'${trunc}'`);
  const periodExpr = sql`date_trunc(${truncLit}, ${schema.salSales.purchasedAt} AT TIME ZONE 'America/Sao_Paulo')`;

  return db
    .select({
      bucket: sql<string>`to_char(${periodExpr}, 'YYYY-MM-DD')`,
      trafficType: schema.salSales.trafficType,
      count: count(schema.salSales.id),
      revenueCents: sql<number>`COALESCE(SUM(${schema.salSales.commissionCents}), 0)::bigint`,
    })
    .from(schema.salSales)
    .where(and(baseWhere(range), eq(schema.salSales.status, 'approved')))
    .groupBy(periodExpr, schema.salSales.trafficType)
    .orderBy(periodExpr);
}

// Mix paid/organic/unknown — total approved.
export async function getSalesByTrafficType(range: SalesRange) {
  return db
    .select({
      trafficType: schema.salSales.trafficType,
      count: count(schema.salSales.id),
      revenueCents: sql<number>`COALESCE(SUM(${schema.salSales.commissionCents}), 0)::bigint`,
    })
    .from(schema.salSales)
    .where(and(baseWhere(range), eq(schema.salSales.status, 'approved')))
    .groupBy(schema.salSales.trafficType)
    .orderBy(desc(count(schema.salSales.id)));
}

// Top campanhas por receita (aprovadas).
export async function getSalesByCampaign(range: SalesRange, limit = 10) {
  return db
    .select({
      campaign: sql<string>`COALESCE(${schema.salSales.utmCampaign}, '(sem campanha)')`,
      count: count(schema.salSales.id),
      revenueCents: sql<number>`COALESCE(SUM(${schema.salSales.commissionCents}), 0)::bigint`,
    })
    .from(schema.salSales)
    .where(and(baseWhere(range), eq(schema.salSales.status, 'approved')))
    .groupBy(schema.salSales.utmCampaign)
    .orderBy(desc(sum(schema.salSales.commissionCents)))
    .limit(limit);
}

// Performance por criativo (utm_term) — vendas aprovadas.
export async function getSalesByCreative(range: SalesRange) {
  return db
    .select({
      term: sql<string>`COALESCE(${schema.salSales.utmTerm}, '(sem termo)')`,
      count: count(schema.salSales.id),
      revenueCents: sql<number>`COALESCE(SUM(${schema.salSales.commissionCents}), 0)::bigint`,
    })
    .from(schema.salSales)
    .where(and(baseWhere(range), eq(schema.salSales.status, 'approved')))
    .groupBy(schema.salSales.utmTerm)
    .orderBy(desc(sum(schema.salSales.commissionCents)));
}

// Placement extraído de utm_content (Feed / Stories / Reels / outros).
export async function getSalesByPlacement(range: SalesRange) {
  return db
    .select({
      placement: sql<string>`CASE
        WHEN ${schema.salSales.utmContent} ILIKE '%Feed' THEN 'Feed'
        WHEN ${schema.salSales.utmContent} ILIKE '%Stories' THEN 'Stories'
        WHEN ${schema.salSales.utmContent} ILIKE '%Reels' THEN 'Reels'
        ELSE 'outros'
      END`,
      count: count(schema.salSales.id),
      revenueCents: sql<number>`COALESCE(SUM(${schema.salSales.commissionCents}), 0)::bigint`,
    })
    .from(schema.salSales)
    .where(and(baseWhere(range), eq(schema.salSales.status, 'approved')))
    .groupBy(sql`CASE
      WHEN ${schema.salSales.utmContent} ILIKE '%Feed' THEN 'Feed'
      WHEN ${schema.salSales.utmContent} ILIKE '%Stories' THEN 'Stories'
      WHEN ${schema.salSales.utmContent} ILIKE '%Reels' THEN 'Reels'
      ELSE 'outros'
    END`)
    .orderBy(desc(count(schema.salSales.id)));
}

// Lista paginada (default últimas 20).
export async function getRecentSales(range: SalesRange, limit = 20) {
  return db
    .select({
      id: schema.salSales.id,
      transactionId: schema.salSales.transactionId,
      purchasedAt: schema.salSales.purchasedAt,
      status: schema.salSales.status,
      buyerName: schema.salSales.buyerName,
      buyerEmail: schema.salSales.buyerEmail,
      utmSource: schema.salSales.utmSource,
      utmTerm: schema.salSales.utmTerm,
      trafficType: schema.salSales.trafficType,
      commissionCents: schema.salSales.commissionCents,
    })
    .from(schema.salSales)
    .where(baseWhere(range))
    .orderBy(desc(schema.salSales.purchasedAt))
    .limit(limit);
}

// Qualidade dos dados — % de preenchimento em vendas aprovadas.
export async function getDataQuality(range: SalesRange) {
  const [row] = await db
    .select({
      total: count(schema.salSales.id),
      withPhone: sql<number>`COUNT(${schema.salSales.buyerPhoneRaw})::int`,
      withE164: sql<number>`COUNT(${schema.salSales.buyerPhoneE164})::int`,
      withUtmSource: sql<number>`COUNT(${schema.salSales.utmSource})::int`,
      withCampaign: sql<number>`COUNT(${schema.salSales.utmCampaign})::int`,
      withTerm: sql<number>`COUNT(${schema.salSales.utmTerm})::int`,
    })
    .from(schema.salSales)
    .where(and(baseWhere(range), eq(schema.salSales.status, 'approved')));

  return row ?? { total: 0, withPhone: 0, withE164: 0, withUtmSource: 0, withCampaign: 0, withTerm: 0 };
}
