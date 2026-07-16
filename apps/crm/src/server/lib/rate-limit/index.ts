/**
 * Rate-limit de janela fixa, lastreado no Postgres (não há KV/Upstash no projeto).
 *
 * Conta requisições por (key, bucket), onde bucket = floor(epoch / windowSeconds).
 * Upsert incremental atômico; devolve se a requisição atual estourou o limite.
 * Nunca lança — em erro de banco, libera (fail-open) pra não derrubar captura de lead.
 */

import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@repo/db/schema';
import { bioRateLimit } from '@repo/db/schema';

export type RateLimitDb = PostgresJsDatabase<typeof schema>;

export interface RateLimitOptions {
  key: string;
  /** máximo de hits permitidos por janela */
  limit: number;
  /** tamanho da janela em segundos */
  windowSeconds: number;
  /** epoch em ms (injetável pra teste); default Date.now() */
  nowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
}

export async function checkRateLimit(
  db: RateLimitDb,
  { key, limit, windowSeconds, nowMs }: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = nowMs ?? Date.now();
  const bucket = String(Math.floor(now / 1000 / windowSeconds));

  try {
    const [row] = await db
      .insert(bioRateLimit)
      .values({ key, bucket, count: 1 })
      .onConflictDoUpdate({
        target: [bioRateLimit.key, bioRateLimit.bucket],
        set: { count: sql`${bioRateLimit.count} + 1`, updatedAt: new Date() },
      })
      .returning({ count: bioRateLimit.count });

    const count = row?.count ?? 1;
    return { allowed: count <= limit, count, limit };
  } catch {
    // fail-open: erro de infra não pode bloquear lead legítimo
    return { allowed: true, count: 0, limit };
  }
}
