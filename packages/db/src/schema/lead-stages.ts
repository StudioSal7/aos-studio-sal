import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { stageKindEnum } from './enums';

export const leadStages = pgTable('lead_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  displayName: text('display_name').notNull(),
  position: integer('position').notNull(),
  kind: stageKindEnum('kind').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type LeadStage = typeof leadStages.$inferSelect;
export type NewLeadStage = typeof leadStages.$inferInsert;
