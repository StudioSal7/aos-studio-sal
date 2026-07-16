import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { meetingStatusEnum } from './enums';
import { googleAccounts } from './google-accounts';
import { leads } from './leads';

export const meetings = pgTable(
  'meetings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    link: text('link'),
    status: meetingStatusEnum('status').notNull().default('agendada'),
    needsConfirmation: boolean('needs_confirmation').notNull().default(false),
    notesPostCall: text('notes_post_call'),
    // Vínculo com o evento na Google Agenda (mão única CRM→Google).
    googleEventId: text('google_event_id'),
    googleAccountId: uuid('google_account_id').references(() => googleAccounts.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    leadIdx: index('meetings_lead_idx').on(table.leadId),
    scheduledIdx: index('meetings_scheduled_idx').on(table.scheduledAt),
    statusIdx: index('meetings_status_idx').on(table.status),
    needsConfirmationIdx: index('meetings_needs_confirmation_idx').on(table.needsConfirmation),
  }),
);

export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
