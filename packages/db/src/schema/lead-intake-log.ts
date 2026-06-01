import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { intakeSourceEnum, intakeStatusEnum } from './enums';
import { leads } from './leads';

export const leadIntakeLog = pgTable(
  'lead_intake_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: intakeSourceEnum('source').notNull(),
    externalId: text('external_id'),
    payloadRaw: jsonb('payload_raw'),
    payloadParsed: jsonb('payload_parsed'),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    status: intakeStatusEnum('status').notNull(),
    errorMessage: text('error_message'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sourceIdx: index('lead_intake_log_source_idx').on(table.source),
    externalIdIdx: index('lead_intake_log_external_id_idx').on(table.externalId),
    leadIdx: index('lead_intake_log_lead_idx').on(table.leadId),
    receivedAtIdx: index('lead_intake_log_received_at_idx').on(table.receivedAt),
  }),
);

export type LeadIntakeLogEntry = typeof leadIntakeLog.$inferSelect;
export type NewLeadIntakeLogEntry = typeof leadIntakeLog.$inferInsert;
