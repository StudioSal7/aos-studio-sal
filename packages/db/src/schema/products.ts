import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { productTipoEnum } from './enums';

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  displayName: text('display_name').notNull(),
  kind: text('kind'),
  ticketMin: integer('ticket_min'),
  ticketMax: integer('ticket_max'),
  // Preço de catálogo em centavos — formatação só na exibição, nunca no dado.
  valorCents: integer('valor_cents'),
  tipo: productTipoEnum('tipo'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
