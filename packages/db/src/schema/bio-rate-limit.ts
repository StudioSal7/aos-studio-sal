import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Janela fixa de rate-limit por chave (IP) para o endpoint público /api/public/bio-lead.
 * Como não há KV/Upstash no projeto, usamos o próprio Postgres: um contador por
 * (key, bucket), onde bucket = floor(epoch / windowSeconds). Upsert incremental.
 *
 * Limpeza é opcional (linhas velhas só ocupam espaço; podem ser apagadas por um
 * cron/manual). Não há FK — é tabela utilitária isolada.
 */
export const bioRateLimit = pgTable(
  'bio_rate_limit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    bucket: text('bucket').notNull(),
    count: integer('count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    keyBucketIdx: uniqueIndex('bio_rate_limit_key_bucket_idx').on(table.key, table.bucket),
  }),
);

export type BioRateLimit = typeof bioRateLimit.$inferSelect;
export type NewBioRateLimit = typeof bioRateLimit.$inferInsert;
