import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { dreSectionEnum, financialEntryKindEnum } from './enums';

// Plano de contas hierárquico. A `dreSection` define em que linha do DRE a
// categoria entra. `isSystem` protege os seeds de exclusão pelo owner.
// `slug` é imutável (mesmo padrão de lead_stages/lead_sources) — chave estável
// para o seed rodar de forma idempotente via onConflictDoNothing.
export const financialCategories = pgTable(
  'financial_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    entryKind: financialEntryKindEnum('entry_kind').notNull(),
    dreSection: dreSectionEnum('dre_section').notNull(),
    // self-FK (subcategorias). Sem referência tipada aqui p/ evitar ciclo; o
    // relacionamento fica em relations.ts.
    parentId: uuid('parent_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    isSystem: boolean('is_system').notNull().default(false),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex('financial_categories_slug_unique').on(table.slug),
    entryKindIdx: index('financial_categories_entry_kind_idx').on(table.entryKind),
    dreSectionIdx: index('financial_categories_dre_section_idx').on(table.dreSection),
    parentIdx: index('financial_categories_parent_idx').on(table.parentId),
  }),
);

export type FinancialCategory = typeof financialCategories.$inferSelect;
export type NewFinancialCategory = typeof financialCategories.$inferInsert;
