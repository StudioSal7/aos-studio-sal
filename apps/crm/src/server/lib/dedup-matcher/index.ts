/**
 * Checks whether an incoming lead candidate already exists in the database.
 *
 * Match rules (any single condition is sufficient):
 *   1. Same respondent_id  → idempotent replay of the same webhook event
 *   2. Same email          → normalised to lowercase for comparison
 *   3. Same whatsapp_e164  → already normalised upstream (E.164)
 *
 * Soft-deleted leads are excluded: a deleted lead should not block a fresh submission.
 * Returns the first match found along with which fields matched.
 */

import { and, eq, isNull, or } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@repo/db/schema';

export type { schema };

// Narrow DB type: only what this module needs (select from leads).
// Using the full generic keeps it compatible with the real Db type.
export type DedupDb = PostgresJsDatabase<typeof schema>;

export type LeadCandidate = {
  intakeRespondentId?: string | null;
  email?: string | null;
  whatsappE164?: string | null;
};

export type MatchResult =
  | { match: true; leadId: string; matchedOn: Array<'respondent_id' | 'email' | 'whatsapp'> }
  | { match: false };

export async function findDuplicateLead(
  candidate: LeadCandidate,
  db: DedupDb,
): Promise<MatchResult> {
  const orConditions = [];

  if (candidate.intakeRespondentId) {
    orConditions.push(eq(schema.leads.intakeRespondentId, candidate.intakeRespondentId));
  }
  if (candidate.email) {
    orConditions.push(eq(schema.leads.email, candidate.email.toLowerCase().trim()));
  }
  if (candidate.whatsappE164) {
    orConditions.push(eq(schema.leads.whatsappE164, candidate.whatsappE164));
  }

  if (orConditions.length === 0) {
    return { match: false };
  }

  const [existing] = await db
    .select({
      id: schema.leads.id,
      intakeRespondentId: schema.leads.intakeRespondentId,
      email: schema.leads.email,
      whatsappE164: schema.leads.whatsappE164,
    })
    .from(schema.leads)
    .where(and(isNull(schema.leads.deletedAt), or(...orConditions)))
    .limit(1);

  if (!existing) {
    return { match: false };
  }

  const matchedOn: Array<'respondent_id' | 'email' | 'whatsapp'> = [];

  if (
    candidate.intakeRespondentId &&
    existing.intakeRespondentId === candidate.intakeRespondentId
  ) {
    matchedOn.push('respondent_id');
  }
  if (
    candidate.email &&
    existing.email?.toLowerCase() === candidate.email.toLowerCase().trim()
  ) {
    matchedOn.push('email');
  }
  if (candidate.whatsappE164 && existing.whatsappE164 === candidate.whatsappE164) {
    matchedOn.push('whatsapp');
  }

  return { match: true, leadId: existing.id, matchedOn };
}
