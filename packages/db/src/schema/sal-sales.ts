import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const salSales = pgTable(
  'sal_sales',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    transactionId: text('transaction_id').notNull(),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull(),

    rawStatus: text('raw_status').notNull(),
    status: text('status').notNull(),

    buyerName: text('buyer_name').notNull(),
    buyerEmail: text('buyer_email').notNull(),
    buyerPhoneRaw: text('buyer_phone_raw'),
    buyerPhoneE164: text('buyer_phone_e164'),

    productName: text('product_name').notNull(),
    productCode: text('product_code').notNull(),
    commissionCents: integer('commission_cents').notNull(),

    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmTerm: text('utm_term'),
    utmContent: text('utm_content'),
    trafficType: text('traffic_type').notNull(),

    rawRow: jsonb('raw_row').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    transactionIdUnique: uniqueIndex('sal_sales_transaction_id_unique').on(table.transactionId),
    purchasedAtIdx: index('sal_sales_purchased_at_idx').on(table.purchasedAt),
    productCodeIdx: index('sal_sales_product_code_idx').on(table.productCode),
    statusApprovedIdx: index('sal_sales_status_approved_idx')
      .on(table.status)
      .where(sql`status = 'approved'`),
    utmCampaignIdx: index('sal_sales_utm_campaign_idx').on(table.utmCampaign),
    utmTermIdx: index('sal_sales_utm_term_idx').on(table.utmTerm),
    utmSourceIdx: index('sal_sales_utm_source_idx').on(table.utmSource),
  }),
);

export type SalSale = typeof salSales.$inferSelect;
export type NewSalSale = typeof salSales.$inferInsert;
