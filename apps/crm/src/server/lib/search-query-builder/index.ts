/**
 * Builds a Drizzle WHERE clause for lead search.
 *
 * Strategy:
 *   - Query length < 3 chars → prefix match (ILIKE 'q%') on all text columns
 *   - Query length >= 3 chars → pg_trgm similarity match (similarity > 0.25)
 *   - Phone-like input (digits only / with spaces) → exact prefix on whatsapp_digits_only
 *   - Optional stageId filter applied on top
 *
 * Requires pg_trgm extension and GIN indexes created by the Drizzle schema.
 */

import { and, eq, isNull, or, sql } from 'drizzle-orm';
import * as schema from '@repo/db/schema';

const TRGM_THRESHOLD = 0.25;
const PREFIX_THRESHOLD = 3;

export type SearchFilters = {
  stageId?: string;
};

export function buildLeadSearchWhere(query: string, filters: SearchFilters = {}) {
  const q = query.trim();

  if (!q) return and(isNull(schema.leads.deletedAt));

  const conditions = [];

  const digits = q.replace(/\D/g, '');
  const isPhoneLike = digits.length >= 5 && digits.length === q.replace(/[\s+]/g, '').length;

  if (isPhoneLike) {
    // Phone search: prefix on the generated digits-only column.
    conditions.push(sql`${schema.leads.whatsappDigitsOnly} LIKE ${digits + '%'}`);
  }

  if (q.length < PREFIX_THRESHOLD) {
    // Short query: prefix ILIKE on text columns.
    const pattern = `${q.toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${schema.leads.name}) LIKE ${pattern}`,
        sql`lower(${schema.leads.nickname}) LIKE ${pattern}`,
        sql`lower(${schema.leads.email}) LIKE ${pattern}`,
        sql`lower(${schema.leads.instagramHandle}) LIKE ${pattern}`,
      ),
    );
  } else {
    // Fuzzy trgm similarity — uses GIN indexes from schema.
    conditions.push(
      or(
        sql`similarity(${schema.leads.name}, ${q}) > ${TRGM_THRESHOLD}`,
        sql`similarity(${schema.leads.nickname}, ${q}) > ${TRGM_THRESHOLD}`,
        sql`similarity(${schema.leads.email}, ${q}) > ${TRGM_THRESHOLD}`,
        sql`similarity(${schema.leads.instagramHandle}, ${q}) > ${TRGM_THRESHOLD}`,
      ),
    );
  }

  const stageFilter = filters.stageId ? eq(schema.leads.stageId, filters.stageId) : undefined;

  return and(isNull(schema.leads.deletedAt), stageFilter, or(...conditions));
}
