import { bigint, index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { leadStages } from './lead-stages';
import { leads } from './leads';
import { users } from './users';

export const leadStageHistory = pgTable(
  'lead_stage_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    fromStageId: uuid('from_stage_id').references(() => leadStages.id),
    toStageId: uuid('to_stage_id')
      .notNull()
      .references(() => leadStages.id),
    durationInPreviousSeconds: bigint('duration_in_previous_seconds', { mode: 'number' }),
    changedBy: uuid('changed_by').references(() => users.id),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadIdx: index('lead_stage_history_lead_idx').on(table.leadId),
    toStageIdx: index('lead_stage_history_to_stage_idx').on(table.toStageId),
    changedAtIdx: index('lead_stage_history_changed_at_idx').on(table.changedAt),
  }),
);

export type LeadStageHistoryEntry = typeof leadStageHistory.$inferSelect;
export type NewLeadStageHistoryEntry = typeof leadStageHistory.$inferInsert;
