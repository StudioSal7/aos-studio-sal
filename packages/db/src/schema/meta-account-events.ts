import { date, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Log MANUAL de mudanças na conta de anúncios (form de 20 segundos na UI).
// Sem isso, curva quebrada é ininterpretável: mudança de orçamento, pausa,
// edição de criativo — tudo que desloca métrica precisa aparecer anotado na
// linha do tempo da vista Tendência.
export const metaAccountEvents = pgTable(
  'meta_account_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Dia do evento no fuso da conta. */
    eventDate: date('event_date').notNull(),
    level: text('level').notNull(), // 'account' | 'campaign' | 'adset' | 'ad'
    /** Id da entidade na Meta — null para eventos de conta. */
    entityId: text('entity_id'),
    eventType: text('event_type').notNull(), // 'budget' | 'pause' | 'resume' | 'creative_edit' | 'launch' | 'other'
    note: text('note').notNull(),

    /** Email de quem anotou — auditoria leve, sem FK. */
    createdBy: text('created_by'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventDateIdx: index('meta_account_events_event_date_idx').on(table.eventDate),
  }),
).enableRLS();

export type MetaAccountEvent = typeof metaAccountEvents.$inferSelect;
export type NewMetaAccountEvent = typeof metaAccountEvents.$inferInsert;
