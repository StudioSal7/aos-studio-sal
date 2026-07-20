import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { MetricTargetInput } from '@/server/lib/metric-target-evaluator/index';

/**
 * Todas as metas cadastradas, indexadas por metric_key. 1 round-trip.
 * `numeric` chega como string do driver — Number() aqui, uma vez só.
 */
export async function getMetricTargets(): Promise<Map<string, MetricTargetInput>> {
  const rows = await db.select().from(schema.metricTargets);
  return new Map(
    rows.map((r) => [
      r.metricKey,
      {
        comparator: r.comparator,
        threshold: Number(r.threshold),
        yellowMargin: Number(r.yellowMargin),
      },
    ]),
  );
}
