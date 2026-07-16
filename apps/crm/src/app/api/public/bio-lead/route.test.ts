/**
 * Route-level tests for POST /api/public/bio-lead. All DB access is mocked
 * (db client, dedup-matcher, rate-limit) — no DATABASE_URL required. Real
 * pure logic (whatsapp-normalizer, bio-lead-guard) runs for real.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import * as schema from '@repo/db/schema';

vi.mock('@repo/db/client', () => ({ db: {} }));
vi.mock('@/server/lib/dedup-matcher/index', () => ({ findDuplicateLead: vi.fn() }));
vi.mock('@/server/lib/rate-limit/index', () => ({ checkRateLimit: vi.fn() }));

import { db as mockDbBinding } from '@repo/db/client';
import { findDuplicateLead } from '@/server/lib/dedup-matcher/index';
import { checkRateLimit } from '@/server/lib/rate-limit/index';
import { POST } from './route';

// The real @repo/db/client type is a complex generic Drizzle builder; the
// fakes below deliberately implement only the narrow chain shapes route.ts
// actually calls, so this boundary is cast loosely on purpose.
const mockDb = mockDbBinding as unknown as Record<string, unknown>;

const mockedFindDuplicateLead = vi.mocked(findDuplicateLead);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);

interface ExistingLeadRow {
  notes: string | null;
  produtoInteresseId: string | null;
  rendaFaixa: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
}

interface FakeDbConfig {
  leadSource?: { id: string };
  product?: { id: string };
  leadStage?: { id: string };
  existingLead?: ExistingLeadRow;
  insertedLeadId?: string;
}

function installFakeDb(config: FakeDbConfig) {
  const calls = {
    updateSets: [] as unknown[],
    insertValues: [] as unknown[],
  };

  Object.assign(mockDb, {
    select(_cols: unknown) {
      return {
        from(table: unknown) {
          return {
            where(_cond: unknown) {
              return {
                limit(_n: number) {
                  if (table === schema.leadSources) {
                    return Promise.resolve(config.leadSource ? [config.leadSource] : []);
                  }
                  if (table === schema.products) {
                    return Promise.resolve(config.product ? [config.product] : []);
                  }
                  if (table === schema.leadStages) {
                    return Promise.resolve(config.leadStage ? [config.leadStage] : []);
                  }
                  if (table === schema.leads) {
                    return Promise.resolve(config.existingLead ? [config.existingLead] : []);
                  }
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
    update(_table: unknown) {
      return {
        set(values: unknown) {
          calls.updateSets.push(values);
          return { where: (_cond: unknown) => Promise.resolve([]) };
        },
      };
    },
    insert(_table: unknown) {
      return {
        values(values: unknown) {
          calls.insertValues.push(values);
          return {
            returning: (_cols: unknown) =>
              Promise.resolve(config.insertedLeadId ? [{ id: config.insertedLeadId }] : []),
          };
        },
      };
    },
  });

  return calls;
}

function makeRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest('https://crm.example.com/api/public/bio-lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const VALID_PAYLOAD = {
  nome: 'Maria',
  email: 'maria@example.com',
  whatsapp: '11999998888',
  respostas: { faturamento: 'ate_5k' },
  intencao: 'quiz' as const,
  leadSourceSlug: 'bio-quiz',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedCheckRateLimit.mockResolvedValue({ allowed: true, count: 1, limit: 8 });
  mockedFindDuplicateLead.mockResolvedValue({ match: false });
});

describe('POST /api/public/bio-lead — IP used for rate-limit (fix #1)', () => {
  it('keys the rate-limit on x-real-ip, ignoring a spoofed leftmost x-forwarded-for', async () => {
    installFakeDb({ leadStage: { id: 'stage-1' }, insertedLeadId: 'lead-1' });

    await POST(
      makeRequest(VALID_PAYLOAD, {
        'x-real-ip': '203.0.113.9',
        'x-forwarded-for': '6.6.6.6, 1.2.3.4', // attacker-controlled leftmost hop
      }),
    );

    expect(mockedCheckRateLimit).toHaveBeenCalledTimes(1);
    const options = mockedCheckRateLimit.mock.calls[0]?.[1];
    expect(options?.key).toBe('203.0.113.9');
  });
});

describe('POST /api/public/bio-lead — enrich protection (fix #2)', () => {
  it('never overwrites a non-empty field on an existing lead, and never sets requiresAttention', async () => {
    const existing: ExistingLeadRow = {
      notes: 'nota antiga',
      produtoInteresseId: null,
      rendaFaixa: 'de R$20.000 a R$30.000 por mês',
      utmSource: 'instagram',
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
    };
    mockedFindDuplicateLead.mockResolvedValue({
      match: true,
      leadId: 'existing-lead-id',
      matchedOn: ['email'],
    });
    const calls = installFakeDb({ existingLead: existing });

    const res = await POST(
      makeRequest(
        {
          ...VALID_PAYLOAD,
          respostas: { faturamento: 'PWNED' },
          utm: { utm_source: 'spam', utm_campaign: 'fills-empty-field' },
          intencao: 'agendar', // attacker claims intent to flip requiresAttention
        },
        { 'x-real-ip': '203.0.113.1' },
      ),
    );

    expect(res.status).toBe(200);
    expect(calls.updateSets).toHaveLength(1);
    const setPayload = calls.updateSets[0] as Record<string, unknown>;

    // Non-empty existing fields must survive untouched.
    expect(setPayload.rendaFaixa).toBeUndefined();
    expect(setPayload.utmSource).toBeUndefined();
    // An empty existing field is legitimately filled.
    expect(setPayload.utmCampaign).toBe('fills-empty-field');
    // A public caller can never flip a THIRD PARTY's workflow flag.
    expect(setPayload).not.toHaveProperty('requiresAttention');
    expect(setPayload).not.toHaveProperty('requiresAttentionReason');
    // Notes are appended, never replaced.
    expect(setPayload.notes).toContain('nota antiga');
  });
});

describe('POST /api/public/bio-lead — uniform response (fix #3)', () => {
  it('returns the identical shape for a brand-new lead and for an enriched existing lead', async () => {
    // New lead.
    mockedFindDuplicateLead.mockResolvedValueOnce({ match: false });
    installFakeDb({ leadStage: { id: 'stage-1' }, insertedLeadId: 'new-lead-id' });
    const newLeadRes = await POST(makeRequest(VALID_PAYLOAD, { 'x-real-ip': '203.0.113.2' }));
    const newLeadBody = await newLeadRes.json();

    // Existing/enriched lead.
    mockedFindDuplicateLead.mockResolvedValueOnce({
      match: true,
      leadId: 'existing-lead-id',
      matchedOn: ['email'],
    });
    installFakeDb({
      existingLead: {
        notes: null,
        produtoInteresseId: null,
        rendaFaixa: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmTerm: null,
        utmContent: null,
      },
    });
    const dupRes = await POST(makeRequest(VALID_PAYLOAD, { 'x-real-ip': '203.0.113.3' }));
    const dupBody = await dupRes.json();

    expect(newLeadRes.status).toBe(dupRes.status);
    expect(newLeadRes.status).toBe(200);
    expect(newLeadBody).toEqual({ ok: true });
    expect(dupBody).toEqual({ ok: true });
    expect(newLeadBody).toEqual(dupBody);
    // Neither leaks a leadId or a duplicate flag.
    expect(newLeadBody).not.toHaveProperty('leadId');
    expect(newLeadBody).not.toHaveProperty('duplicate');
    expect(dupBody).not.toHaveProperty('leadId');
    expect(dupBody).not.toHaveProperty('duplicate');
  });
});

describe('POST /api/public/bio-lead — payload size caps (fix #5)', () => {
  it('rejects an oversized field with 400 and performs no DB write', async () => {
    const calls = installFakeDb({ leadStage: { id: 'stage-1' }, insertedLeadId: 'lead-1' });

    const res = await POST(
      makeRequest({ ...VALID_PAYLOAD, nome: 'x'.repeat(201) }, { 'x-real-ip': '203.0.113.4' }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('payload_too_large');
    expect(body.field).toBe('nome');
    expect(calls.insertValues).toHaveLength(0);
    expect(calls.updateSets).toHaveLength(0);
  });

  it('rejects an oversized resumo (the notes-bloat vector)', async () => {
    installFakeDb({ leadStage: { id: 'stage-1' }, insertedLeadId: 'lead-1' });
    const res = await POST(
      makeRequest({ ...VALID_PAYLOAD, resumo: 'x'.repeat(4001) }, { 'x-real-ip': '203.0.113.5' }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe('resumo');
  });
});

describe('POST /api/public/bio-lead — leadSourceSlug allowlist (fix #7)', () => {
  it('clamps an attacker-chosen source slug to the default instead of trusting the client', async () => {
    // leadSources lookup always misses, regardless of which slug was queried
    // — isolates the assertion to what route.ts PASSES as sourceSlug.
    const calls = installFakeDb({ leadStage: { id: 'stage-1' }, insertedLeadId: 'lead-1' });

    await POST(
      makeRequest(
        { ...VALID_PAYLOAD, leadSourceSlug: 'giu_salvatore_indicacao' },
        { 'x-real-ip': '203.0.113.6' },
      ),
    );

    expect(calls.insertValues).toHaveLength(1);
    const insertPayload = calls.insertValues[0] as Record<string, unknown>;
    // Falls back to the allowlisted default, never the attacker-chosen slug.
    expect(insertPayload.leadSourceOther).toBe('bio-quiz');
  });

  it('accepts the legitimate bio-quiz slug unchanged', async () => {
    const calls = installFakeDb({ leadStage: { id: 'stage-1' }, insertedLeadId: 'lead-1' });
    await POST(makeRequest(VALID_PAYLOAD, { 'x-real-ip': '203.0.113.7' }));
    const insertPayload = calls.insertValues[0] as Record<string, unknown>;
    expect(insertPayload.leadSourceOther).toBe('bio-quiz');
  });
});

describe('POST /api/public/bio-lead — stage_not_seeded is loud (fix #6)', () => {
  it('logs an actionable error before returning 500 when the stage is missing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    installFakeDb({}); // no leadStage configured → lookup misses

    const res = await POST(makeRequest(VALID_PAYLOAD, { 'x-real-ip': '203.0.113.8' }));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('stage_not_seeded');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('stage_not_seeded'));

    consoleError.mockRestore();
  });
});

describe('POST /api/public/bio-lead — untouched paths still behave (smoke)', () => {
  it('still returns the generic 200 ok on honeypot without touching the DB', async () => {
    const calls = installFakeDb({});
    const res = await POST(
      makeRequest({ ...VALID_PAYLOAD, empresa: 'sou um bot' }, { 'x-real-ip': '203.0.113.10' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(calls.insertValues).toHaveLength(0);
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it('still rejects when rate-limited', async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: false, count: 9, limit: 8 });
    installFakeDb({ leadStage: { id: 'stage-1' } });
    const res = await POST(makeRequest(VALID_PAYLOAD, { 'x-real-ip': '203.0.113.11' }));
    expect(res.status).toBe(429);
  });

  it('still rejects missing required fields', async () => {
    installFakeDb({ leadStage: { id: 'stage-1' } });
    const res = await POST(makeRequest({ nome: 'Maria' }, { 'x-real-ip': '203.0.113.12' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_payload');
  });
});
