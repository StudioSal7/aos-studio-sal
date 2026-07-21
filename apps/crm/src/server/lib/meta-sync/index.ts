/**
 * meta-sync — orquestrador do sync de insights Meta Ads (usa DB).
 *
 * Fluxo: abre linha em `meta_sync_runs` → fetch (meta-client) → map
 * (meta-insights-mapper) → upsert chunked em `meta_insights_daily` → fecha a
 * linha (ok/error). O cron re-upserta D-7→D-1 todo dia; o backfill percorre
 * janelas de 30 dias pela MESMA função.
 *
 * Upsert: TODAS as colunas mutáveis no set via sql`excluded.<snake_case>` —
 * referência de coluna Drizzle no set serializa como auto-referência (no-op
 * silencioso), e nome fora do set faz anúncio renomeado virar linha nova
 * (gotcha pago no ba-hub, fix 8c361e9).
 */

import { sql } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { NewMetaInsightDaily } from '@repo/db/schema';
import { fetchAdInsights } from '../meta-client/index';
import { mapInsightRow } from '../meta-insights-mapper/index';

/**
 * Janela rolante re-upsertada a cada run do cron (D-7 → D-1). A Meta reajusta
 * atribuição retroativamente por até 28 dias; 7 dias re-escritos diariamente
 * cobrem a janela de atribuição padrão (7d click) por construção — conversão
 * atribuída depois disso é aceita como perda (decisão fecha em D-3).
 */
export const RESYNC_WINDOW_DAYS = 7;

/** Teto de segurança do postgres-js: 65534 parâmetros/query (24 colunas × 500 ≈ 12k). */
const INSERT_BATCH_SIZE = 500;

export type SyncTrigger = 'cron' | 'backfill' | 'manual';

export interface SyncResult {
  runId: string;
  status: 'ok' | 'error';
  rowsUpserted: number;
  since: string;
  until: string;
  error?: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Janelas de backfill: [since, until] fatiado em blocos de `chunkDays` dias
 * inclusivos. Puro — testável sem DB.
 */
export function backfillWindows(
  since: string,
  until: string,
  chunkDays = 30,
): Array<{ since: string; until: string }> {
  const start = new Date(`${since}T00:00:00Z`);
  const end = new Date(`${until}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const windows: Array<{ since: string; until: string }> = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const windowEnd = new Date(cursor);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + chunkDays - 1);
    if (windowEnd > end) windowEnd.setTime(end.getTime());
    windows.push({
      since: cursor.toISOString().slice(0, 10),
      until: windowEnd.toISOString().slice(0, 10),
    });
    cursor.setUTCDate(cursor.getUTCDate() + chunkDays);
  }
  return windows;
}

/** Upsert idempotente por (date, ad_id), em chunks. Retorna o total de linhas gravadas. */
export async function upsertInsights(rows: NewMetaInsightDaily[]): Promise<number> {
  let written = 0;

  for (const batch of chunk(rows, INSERT_BATCH_SIZE)) {
    await db
      .insert(schema.metaInsightsDaily)
      .values(batch)
      .onConflictDoUpdate({
        target: [schema.metaInsightsDaily.date, schema.metaInsightsDaily.adId],
        set: {
          campaignId: sql`excluded.campaign_id`,
          campaignName: sql`excluded.campaign_name`,
          adsetId: sql`excluded.adset_id`,
          adsetName: sql`excluded.adset_name`,
          adName: sql`excluded.ad_name`,
          spendCents: sql`excluded.spend_cents`,
          impressions: sql`excluded.impressions`,
          reachDaily: sql`excluded.reach_daily`,
          linkClicks: sql`excluded.link_clicks`,
          landingPageViews: sql`excluded.landing_page_views`,
          video3s: sql`excluded.video_3s`,
          videoP25: sql`excluded.video_p25`,
          videoP50: sql`excluded.video_p50`,
          videoP75: sql`excluded.video_p75`,
          videoP95: sql`excluded.video_p95`,
          purchases: sql`excluded.purchases`,
          purchaseValueCents: sql`excluded.purchase_value_cents`,
          actionsRaw: sql`excluded.actions_raw`,
          syncedAt: sql`now()`,
          updatedAt: sql`now()`,
        },
      });
    written += batch.length;
  }

  return written;
}

/** Executa um sync completo da janela [since, until], com bookkeeping em meta_sync_runs. */
export async function runMetaSync(opts: {
  since: string;
  until: string;
  trigger: SyncTrigger;
}): Promise<SyncResult> {
  const [run] = await db
    .insert(schema.metaSyncRuns)
    .values({
      sinceDate: opts.since,
      untilDate: opts.until,
      trigger: opts.trigger,
      status: 'running',
    })
    .returning({ id: schema.metaSyncRuns.id });

  if (!run) throw new Error('meta_sync_runs insert returned no rows');

  try {
    const raw = await fetchAdInsights({ since: opts.since, until: opts.until });
    const mapped = raw.map(mapInsightRow);
    const rowsUpserted = await upsertInsights(mapped);

    await db
      .update(schema.metaSyncRuns)
      .set({ status: 'ok', rowsUpserted, finishedAt: new Date() })
      .where(sql`${schema.metaSyncRuns.id} = ${run.id}`);

    return { runId: run.id, status: 'ok', rowsUpserted, since: opts.since, until: opts.until };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await db
      .update(schema.metaSyncRuns)
      .set({ status: 'error', error: message, finishedAt: new Date() })
      .where(sql`${schema.metaSyncRuns.id} = ${run.id}`);

    return {
      runId: run.id,
      status: 'error',
      rowsUpserted: 0,
      since: opts.since,
      until: opts.until,
      error: message,
    };
  }
}
