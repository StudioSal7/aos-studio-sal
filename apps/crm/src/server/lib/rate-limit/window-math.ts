/**
 * Aritmética pura da janela deslizante aproximada (fixed-window ponderado).
 * Sem DB, sem I/O — ver index.ts pro orquestrador que lê/escreve no Postgres.
 *
 * Um fixed-window puro deixa passar até 2x o limite na borda (rajada no fim
 * de um bucket + rajada no início do próximo). A ponderação do bucket
 * ANTERIOR pela fração da janela atual ainda "coberta" por ele fecha isso:
 * logo após uma rajada cheia, o próximo bucket nasce quase saturado e só
 * libera cota conforme o peso do anterior decai com o tempo.
 */

export interface SlidingWindowInput {
  currentCount: number;
  previousCount: number;
  /** epoch em segundos (não precisa ser inteiro) */
  nowSeconds: number;
  currentBucketIndex: number;
  windowSeconds: number;
  limit: number;
}

export interface SlidingWindowResult {
  allowed: boolean;
  /** contagem ponderada (bucket atual + fração do anterior) usada na decisão */
  weighted: number;
}

export function evaluateSlidingWindow({
  currentCount,
  previousCount,
  nowSeconds,
  currentBucketIndex,
  windowSeconds,
  limit,
}: SlidingWindowInput): SlidingWindowResult {
  const elapsedInWindow = nowSeconds - currentBucketIndex * windowSeconds;
  const previousWeight = 1 - Math.min(Math.max(elapsedInWindow / windowSeconds, 0), 1);
  const weighted = previousCount * previousWeight + currentCount;
  return { allowed: weighted <= limit, weighted };
}

export function bucketIndexFor(nowMs: number, windowSeconds: number): number {
  return Math.floor(nowMs / 1000 / windowSeconds);
}
