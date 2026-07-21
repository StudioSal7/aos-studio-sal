import {
  index,
  integer,
  jsonb,
  pgTable,
  date,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Tabela-fato do pipeline de Meta Ads. Grão = dia × anúncio (level=ad,
// time_increment=1). Guarda CONTAGENS BRUTAS — todo ratio (CPA, ROAS, CTR,
// hook, hold...) é calculado no código por janela (Σ/Σ), nunca persistido.
// Sempre escrita por upsert em (date, ad_id): a janela D-7→D-1 é re-upsertada
// todo dia, o que absorve a reatribuição retroativa da Meta por construção.
//
// Contagens são notNull default 0 (zero é 0, nunca NULL — NULL ≠ 0 no Postgres
// já quebrou painel de agregação em produção no ba-hub). Como o único nível é
// `ad`, a chave (date, ad_id) não tem colunas NULL — NULLS NOT DISTINCT
// desnecessário (seria obrigatório se houvesse linhas level=account).
export const metaInsightsDaily = pgTable(
  'meta_insights_daily',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Dia no fuso da conta de anúncios (America/Sao_Paulo) — comparação por string. */
    date: date('date').notNull(),
    adId: text('ad_id').notNull(),

    // Dimensões desnormalizadas de propósito: nome muda na Meta, o histórico
    // preserva o nome do dia. Segmento (frio/quente) resolve por config no read.
    campaignId: text('campaign_id').notNull(),
    campaignName: text('campaign_name').notNull(),
    adsetId: text('adset_id').notNull(),
    adsetName: text('adset_name').notNull(),
    adName: text('ad_name').notNull(),

    spendCents: integer('spend_cents').notNull().default(0),
    impressions: integer('impressions').notNull().default(0),
    /** Alcance do DIA — não-aditivo entre dias; só serve como proxy de frequência. */
    reachDaily: integer('reach_daily').notNull().default(0),

    linkClicks: integer('link_clicks').notNull().default(0),
    landingPageViews: integer('landing_page_views').notNull().default(0),

    video3s: integer('video_3s').notNull().default(0),
    videoP25: integer('video_p25').notNull().default(0),
    videoP50: integer('video_p50').notNull().default(0),
    videoP75: integer('video_p75').notNull().default(0),
    videoP95: integer('video_p95').notNull().default(0),

    // Compra resolvida por precedência estrita de action_type
    // (fb_pixel_purchase → purchase → omni_purchase), NUNCA soma entre types.
    purchases: integer('purchases').notNull().default(0),
    purchaseValueCents: integer('purchase_value_cents').notNull().default(0),

    /**
     * Payload cru { actions, action_values } — evento futuro (lead, checkout)
     * entra sem migration; fórmula errada se corrige na query sem re-sync.
     */
    actionsRaw: jsonb('actions_raw').notNull(),

    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dateAdUnique: uniqueIndex('meta_insights_daily_date_ad_unique').on(table.date, table.adId),
    adIdIdx: index('meta_insights_daily_ad_id_idx').on(table.adId),
    dateIdx: index('meta_insights_daily_date_idx').on(table.date),
  }),
).enableRLS();

export type MetaInsightDaily = typeof metaInsightsDaily.$inferSelect;
export type NewMetaInsightDaily = typeof metaInsightsDaily.$inferInsert;
