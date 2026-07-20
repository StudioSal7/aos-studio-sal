import { date, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Log de execução do sync de Meta Ads — idempotência + debug. Uma linha por
// run (cron diário, janela de backfill ou disparo manual). Sem status
// 'partial': conta única e janela única são a unidade mais fina de trabalho —
// erro é erro, e o backfill é resumível por --since.
export const metaSyncRuns = pgTable('meta_sync_runs', {
  id: uuid('id').primaryKey().defaultRandom(),

  /** Janela puxada (dias no fuso da conta, inclusivos). */
  sinceDate: date('since_date').notNull(),
  untilDate: date('until_date').notNull(),

  trigger: text('trigger').notNull(), // 'cron' | 'backfill' | 'manual'
  status: text('status').notNull(), // 'running' | 'ok' | 'error'
  rowsUpserted: integer('rows_upserted').notNull().default(0),
  error: text('error'),

  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export type MetaSyncRun = typeof metaSyncRuns.$inferSelect;
export type NewMetaSyncRun = typeof metaSyncRuns.$inferInsert;
