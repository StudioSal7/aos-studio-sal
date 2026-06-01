import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const leadObjections = pgTable('lead_objections', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  displayName: text('display_name').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type LeadObjection = typeof leadObjections.$inferSelect;
export type NewLeadObjection = typeof leadObjections.$inferInsert;
