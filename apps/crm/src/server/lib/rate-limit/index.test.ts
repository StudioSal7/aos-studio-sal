/**
 * Integration tests for checkRateLimit (the Postgres glue around the pure
 * sliding-window math — see window-math.test.ts for the arithmetic itself).
 *
 * Requires a real Postgres database with migration 0012 (bio_rate_limit)
 * applied. Skipped automatically when DATABASE_URL is not set — same
 * convention as server/lib/dedup-matcher/index.test.ts.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RateLimitDb } from './index';
import { checkRateLimit } from './index';

const hasDb = !!process.env.DATABASE_URL;

describe('checkRateLimit — fail-open (no DB required)', () => {
  it('fails open and logs when the DB call throws, instead of failing silently', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const boom = new Error('connection refused');
    const throwingDb = {
      insert() {
        throw boom;
      },
    } as unknown as RateLimitDb;

    const result = await checkRateLimit(throwingDb, { key: 'k', limit: 1, windowSeconds: 600 });

    expect(result).toEqual({ allowed: true, count: 0, limit: 1 });
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('checkRateLimit failed, failing open'),
      boom,
    );

    consoleError.mockRestore();
  });
});

const TEST_PREFIX = `test-rate-limit-${Date.now()}`;
const key = (n: number) => `${TEST_PREFIX}-${n}`;

describe.skipIf(!hasDb)('checkRateLimit — integration', () => {
  let db: RateLimitDb;

  beforeAll(async () => {
    const { db: dbInstance } = await import('@repo/db/client');
    db = dbInstance as RateLimitDb;
  });

  afterAll(async () => {
    if (!db) return;
    const schema = await import('@repo/db/schema');
    const { like } = await import('drizzle-orm');
    await db.delete(schema.bioRateLimit).where(like(schema.bioRateLimit.key, `${TEST_PREFIX}%`));
  });

  it('allows the first request and increments on repeat calls with the same key', async () => {
    const k = key(1);
    const first = await checkRateLimit(db, { key: k, limit: 3, windowSeconds: 600 });
    expect(first.allowed).toBe(true);

    const second = await checkRateLimit(db, { key: k, limit: 3, windowSeconds: 600 });
    expect(second.allowed).toBe(true);
    expect(second.count).toBeGreaterThan(first.count);
  });

  it('rejects once the limit is exceeded within the same window', async () => {
    const k = key(2);
    let last: Awaited<ReturnType<typeof checkRateLimit>> | undefined;
    for (let i = 0; i < 5; i++) {
      last = await checkRateLimit(db, { key: k, limit: 3, windowSeconds: 600 });
    }
    expect(last?.allowed).toBe(false);
  });

  it('keys are independent — a different key starts with its own fresh quota', async () => {
    const k = key(3);
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(db, { key: k, limit: 3, windowSeconds: 600 });
    }
    const otherKey = await checkRateLimit(db, { key: key(4), limit: 3, windowSeconds: 600 });
    expect(otherKey.allowed).toBe(true);
  });
});
