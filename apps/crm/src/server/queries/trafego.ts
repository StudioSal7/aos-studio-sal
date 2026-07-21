/**
 * Queries do dashboard /trafego — EXATAMENTE 3 por page load (pool max:10;
 * lição do incidente do /dashboard: nunca dezenas de queries concorrentes).
 * As linhas diárias cruas de ~5 semanas × ~30 anúncios são ~1k linhas —
 * busca 1x e TODA a derivação acontece no código (ads-report), não em SQL.
 * Auth é responsabilidade da page (convenção do app).
 */

import { and, desc, gte, lte } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { MetaAccountEvent, MetaInsightDaily, MetaSyncRun } from '@repo/db/schema';

/** Linhas diárias cruas da janela [since, until] (dias inclusivos). */
export async function getInsightsRange(since: string, until: string): Promise<MetaInsightDaily[]> {
  return db
    .select()
    .from(schema.metaInsightsDaily)
    .where(and(gte(schema.metaInsightsDaily.date, since), lte(schema.metaInsightsDaily.date, until)))
    .orderBy(schema.metaInsightsDaily.date);
}

/** Eventos manuais da conta a partir de `since` (anotações da vista Tendência). */
export async function getAccountEvents(since: string): Promise<MetaAccountEvent[]> {
  return db
    .select()
    .from(schema.metaAccountEvents)
    .where(gte(schema.metaAccountEvents.eventDate, since))
    .orderBy(desc(schema.metaAccountEvents.eventDate), desc(schema.metaAccountEvents.createdAt));
}

/** Último run do sync (banner de status + empty state tri-estado). */
export async function getLastSyncRun(): Promise<MetaSyncRun | null> {
  const [run] = await db
    .select()
    .from(schema.metaSyncRuns)
    .orderBy(desc(schema.metaSyncRuns.startedAt))
    .limit(1);
  return run ?? null;
}
