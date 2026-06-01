/**
 * Integration tests for dedup-matcher.
 *
 * Requires a real Postgres database (Supabase local or test container).
 * Run `supabase start` first, then set DATABASE_URL to the local connection string.
 *
 * Tests are skipped automatically when DATABASE_URL is not set.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findDuplicateLead, type DedupDb } from './index';

const hasDb = !!process.env.DATABASE_URL;

// Unique prefix so parallel test runs don't collide.
const TEST_PREFIX = `test-dedup-${Date.now()}`;
const email = (n: number) => `${TEST_PREFIX}-${n}@example.com`;
const whatsapp = (n: number) => `+5511900${String(n).padStart(6, '0')}`;

describe.skipIf(!hasDb)('findDuplicateLead — integration', () => {
  let db: DedupDb;
  let stageId: string;
  const insertedLeadIds: string[] = [];

  beforeAll(async () => {
    const { db: dbInstance } = await import('@repo/db/client');
    const schema = await import('@repo/db/schema');

    db = dbInstance as DedupDb;

    // Grab any existing stage to satisfy the FK constraint.
    const [stage] = await db.select({ id: schema.leads.stageId }).from(schema.leads).limit(1);
    if (!stage) {
      // If no leads exist yet, grab from lead_stages directly.
      const [s] = await db
        .select({ id: schema.leadStages.id })
        .from(schema.leadStages)
        .limit(1);
      if (!s) throw new Error('No stages seeded — run pnpm db:seed first.');
      stageId = s.id;
    } else {
      stageId = stage.id;
    }

    // Seed two known leads for the test suite.
    const inserted = await db
      .insert(schema.leads)
      .values([
        {
          intakeRespondentId: `${TEST_PREFIX}-resp-1`,
          email: email(1),
          whatsappE164: whatsapp(1),
          stageId,
        },
        {
          intakeRespondentId: `${TEST_PREFIX}-resp-2`,
          email: email(2),
          whatsappE164: whatsapp(2),
          stageId,
        },
      ])
      .returning({ id: schema.leads.id });

    for (const row of inserted) insertedLeadIds.push(row.id);
  });

  afterAll(async () => {
    if (!db || insertedLeadIds.length === 0) return;
    const schema = await import('@repo/db/schema');
    const { inArray } = await import('drizzle-orm');
    await db.delete(schema.leads).where(inArray(schema.leads.id, insertedLeadIds));
  });

  it('retorna match: false para candidato sem nenhuma chave', async () => {
    const result = await findDuplicateLead({}, db);
    expect(result.match).toBe(false);
  });

  it('retorna match: false para lead completamente novo', async () => {
    const result = await findDuplicateLead(
      { email: `novissimo-${TEST_PREFIX}@example.com`, whatsappE164: '+5521999000001' },
      db,
    );
    expect(result.match).toBe(false);
  });

  it('encontra match por respondent_id (idempotência de webhook)', async () => {
    const result = await findDuplicateLead(
      { intakeRespondentId: `${TEST_PREFIX}-resp-1` },
      db,
    );
    expect(result.match).toBe(true);
    if (!result.match) return;
    expect(result.leadId).toBe(insertedLeadIds[0]);
    expect(result.matchedOn).toContain('respondent_id');
  });

  it('encontra match por email exato', async () => {
    const result = await findDuplicateLead({ email: email(1) }, db);
    expect(result.match).toBe(true);
    if (!result.match) return;
    expect(result.leadId).toBe(insertedLeadIds[0]);
    expect(result.matchedOn).toContain('email');
  });

  it('encontra match por email case-insensitive (maiúsculas)', async () => {
    const result = await findDuplicateLead({ email: email(1).toUpperCase() }, db);
    expect(result.match).toBe(true);
    if (!result.match) return;
    expect(result.matchedOn).toContain('email');
  });

  it('encontra match por whatsapp E.164', async () => {
    const result = await findDuplicateLead({ whatsappE164: whatsapp(2) }, db);
    expect(result.match).toBe(true);
    if (!result.match) return;
    expect(result.leadId).toBe(insertedLeadIds[1]);
    expect(result.matchedOn).toContain('whatsapp');
  });

  it('encontra match quando email é novo mas whatsapp já existe', async () => {
    const result = await findDuplicateLead(
      { email: `brand-new-${TEST_PREFIX}@example.com`, whatsappE164: whatsapp(1) },
      db,
    );
    expect(result.match).toBe(true);
    if (!result.match) return;
    expect(result.matchedOn).toContain('whatsapp');
  });

  it('registra múltiplos campos no matchedOn quando há coincidência dupla', async () => {
    const result = await findDuplicateLead(
      { email: email(1), whatsappE164: whatsapp(1) },
      db,
    );
    expect(result.match).toBe(true);
    if (!result.match) return;
    expect(result.matchedOn).toContain('email');
    expect(result.matchedOn).toContain('whatsapp');
  });
});
