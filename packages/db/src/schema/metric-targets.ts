import { sql } from 'drizzle-orm';
import { check, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { metricComparatorEnum } from './enums';

// Metas do dashboard (meta = dado no banco; catálogo de chaves = código —
// ver apps/crm server/lib/metric-registry). Métrica sem linha aqui → cinza na UI.
export const metricTargets = pgTable(
  'metric_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    metricKey: text('metric_key').notNull().unique(),
    comparator: metricComparatorEnum('comparator').notNull(),
    threshold: numeric('threshold', { precision: 10, scale: 2 }).notNull(),
    // Margem da faixa "quase" (amarelo). 0 = sem faixa amarela (verde/vermelho binário).
    yellowMargin: numeric('yellow_margin', { precision: 10, scale: 2 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    thresholdNonNegative: check('metric_targets_threshold_non_negative', sql`threshold >= 0`),
    yellowMarginNonNegative: check(
      'metric_targets_yellow_margin_non_negative',
      sql`yellow_margin >= 0`,
    ),
  }),
)
  // RLS deny-all (padrão da 0011): app acessa via service_role/conexão direta,
  // só o acesso anônimo (PostgREST) fica negado. Declarar aqui mantém o schema TS
  // alinhado ao banco — senão um db:generate futuro emitiria DISABLE ROW LEVEL SECURITY.
  .enableRLS();

export type MetricTarget = typeof metricTargets.$inferSelect;
export type NewMetricTarget = typeof metricTargets.$inferInsert;
