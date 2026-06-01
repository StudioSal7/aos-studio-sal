import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { actionCompletionKindEnum, nextActionTypeEnum } from './enums';
import { leads } from './leads';
import { users } from './users';

export const leadActionLog = pgTable(
  'lead_action_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    actionAt: timestamp('action_at', { withTimezone: true }).notNull(),
    actionType: nextActionTypeEnum('action_type').notNull(),
    notes: text('notes'),
    setBy: uuid('set_by').references(() => users.id),
    setAt: timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
    completedBy: uuid('completed_by').references(() => users.id),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completionKind: actionCompletionKindEnum('completion_kind'),
  },
  (table) => ({
    leadIdx: index('lead_action_log_lead_idx').on(table.leadId),
    actionAtIdx: index('lead_action_log_action_at_idx').on(table.actionAt),
  }),
);

export type LeadActionLogEntry = typeof leadActionLog.$inferSelect;
export type NewLeadActionLogEntry = typeof leadActionLog.$inferInsert;
