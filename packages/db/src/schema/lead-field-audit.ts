import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { leads } from './leads';
import { users } from './users';

export const leadFieldAudit = pgTable(
  'lead_field_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    fieldName: text('field_name').notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    changedBy: uuid('changed_by').references(() => users.id),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
    requestId: text('request_id'),
  },
  (table) => ({
    leadIdx: index('lead_field_audit_lead_idx').on(table.leadId),
    fieldIdx: index('lead_field_audit_field_idx').on(table.fieldName),
    changedAtIdx: index('lead_field_audit_changed_at_idx').on(table.changedAt),
  }),
);

export type LeadFieldAuditEntry = typeof leadFieldAudit.$inferSelect;
export type NewLeadFieldAuditEntry = typeof leadFieldAudit.$inferInsert;
