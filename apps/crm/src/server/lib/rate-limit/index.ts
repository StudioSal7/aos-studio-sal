/**
 * Rate-limit de janela deslizante aproximada (fixed-window ponderado),
 * lastreado no Postgres (não há KV/Upstash no projeto).
 *
 * Conta requisições por (key, bucket), onde bucket = floor(epoch / windowSeconds).
 * A aritmética da janela deslizante ponderada (o que fecha o estouro de até
 * 2x na borda de um fixed-window puro) vive em `window-math.ts`, pura e
 * testada isoladamente — este módulo é só o glue de leitura/escrita no
 * Postgres em cima dela.
 *
 * Upsert incremental atômico no bucket atual; leitura simples do anterior
 * (pequena janela de corrida no exato instante da borda é aceitável — isto
 * é um freio anti-spam, não um limitador de precisão financeira).
 *
 * Nunca lança — em erro de banco, libera (fail-open) pra não derrubar captura
 * de lead legítimo — mas LOGA o erro: fail-open silencioso é rate-limit
 * desligado sem ninguém perceber.
 *
 * Limpeza oportunística: com baixa probabilidade a cada chamada, apaga linhas
 * mais velhas que 2 janelas (sem cron dedicado — é o caminho mais leve dado
 * que toda chamada já grava nesta tabela).
 */

import { and, eq, lt, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@repo/db/schema';
import { bioRateLimit } from '@repo/db/schema';
import { bucketIndexFor, evaluateSlidingWindow } from './window-math';

export type RateLimitDb = PostgresJsDatabase<typeof schema>;

export interface RateLimitOptions {
  key: string;
  /** máximo de hits permitidos por janela */
  limit: number;
  /** tamanho da janela em segundos */
  windowSeconds: number;
  /** epoch em ms (injetável pra teste); default Date.now() */
  nowMs?: number;
  /** probabilidade (0–1) de rodar a limpeza oportunística nesta chamada; default 0.05 */
  cleanupProbability?: number;
  /** gerador de aleatoriedade (injetável pra teste); default Math.random */
  random?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** contagem ponderada (bucket atual + fração do anterior) usada na decisão */
  count: number;
  limit: number;
}

export async function checkRateLimit(
  db: RateLimitDb,
  {
    key,
    limit,
    windowSeconds,
    nowMs,
    cleanupProbability = 0.05,
    random = Math.random,
  }: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = nowMs ?? Date.now();
  const nowSeconds = now / 1000;
  const currentBucketIndex = bucketIndexFor(now, windowSeconds);
  const currentBucket = String(currentBucketIndex);
  const previousBucket = String(currentBucketIndex - 1);

  try {
    const [currentRow] = await db
      .insert(bioRateLimit)
      .values({ key, bucket: currentBucket, count: 1 })
      .onConflictDoUpdate({
        target: [bioRateLimit.key, bioRateLimit.bucket],
        set: { count: sql`${bioRateLimit.count} + 1`, updatedAt: new Date() },
      })
      .returning({ count: bioRateLimit.count });

    const [previousRow] = await db
      .select({ count: bioRateLimit.count })
      .from(bioRateLimit)
      .where(and(eq(bioRateLimit.key, key), eq(bioRateLimit.bucket, previousBucket)))
      .limit(1);

    const { allowed, weighted } = evaluateSlidingWindow({
      currentCount: currentRow?.count ?? 1,
      previousCount: previousRow?.count ?? 0,
      nowSeconds,
      currentBucketIndex,
      windowSeconds,
      limit,
    });

    if (random() < cleanupProbability) {
      try {
        const cutoff = new Date(now - windowSeconds * 2 * 1000);
        await db.delete(bioRateLimit).where(lt(bioRateLimit.updatedAt, cutoff));
      } catch (cleanupErr) {
        // Limpeza é oportunística/não-crítica — não deve derrubar a decisão real.
        console.error('[rate-limit] opportunistic cleanup failed (non-fatal)', cleanupErr);
      }
    }

    return { allowed, count: Math.round(weighted * 100) / 100, limit };
  } catch (err) {
    // fail-open: erro de infra não pode bloquear lead legítimo — mas loga,
    // senão o rate-limit fica desligado em silêncio sem ninguém perceber
    // (ex.: migration da tabela não aplicada, índice único ausente/renomeado).
    console.error('[rate-limit] checkRateLimit failed, failing open', err);
    return { allowed: true, count: 0, limit };
  }
}
