import { describe, expect, it } from 'vitest';
import { bucketIndexFor, evaluateSlidingWindow } from './window-math';

describe('bucketIndexFor', () => {
  it('buckets epoch ms into windowSeconds-sized slots', () => {
    expect(bucketIndexFor(0, 600)).toBe(0);
    expect(bucketIndexFor(599_999, 600)).toBe(0);
    expect(bucketIndexFor(600_000, 600)).toBe(1);
    expect(bucketIndexFor(1_199_999, 600)).toBe(1);
    expect(bucketIndexFor(1_200_000, 600)).toBe(2);
  });
});

describe('evaluateSlidingWindow', () => {
  const windowSeconds = 600;
  const limit = 8;

  it('allows normal light usage with no previous-bucket history', () => {
    // 4 spread-out requests, nothing in the previous bucket.
    for (let currentCount = 1; currentCount <= 4; currentCount++) {
      const { allowed } = evaluateSlidingWindow({
        currentCount,
        previousCount: 0,
        nowSeconds: 100,
        currentBucketIndex: 0,
        windowSeconds,
        limit,
      });
      expect(allowed).toBe(true);
    }
  });

  it('allows exactly up to the limit within a single bucket', () => {
    const { allowed } = evaluateSlidingWindow({
      currentCount: 8,
      previousCount: 0,
      nowSeconds: 100,
      currentBucketIndex: 0,
      windowSeconds,
      limit,
    });
    expect(allowed).toBe(true);
  });

  it('rejects the 9th request within a single bucket', () => {
    const { allowed } = evaluateSlidingWindow({
      currentCount: 9,
      previousCount: 0,
      nowSeconds: 100,
      currentBucketIndex: 0,
      windowSeconds,
      limit,
    });
    expect(allowed).toBe(false);
  });

  it('closes the classic fixed-window boundary-burst gap (8 + 8 in seconds)', () => {
    // Bucket N: full burst of 8, all allowed (previous bucket N-1 has no history).
    for (let currentCount = 1; currentCount <= 8; currentCount++) {
      const { allowed } = evaluateSlidingWindow({
        currentCount,
        previousCount: 0,
        nowSeconds: 599.9, // right before the boundary
        currentBucketIndex: 0,
        windowSeconds,
        limit,
      });
      expect(allowed).toBe(true);
    }

    // Bucket N+1 starts a fraction of a second later. A pure fixed window
    // would reset to a fresh quota of 8 here (16 total in ~seconds). The
    // weighted window must NOT allow that: previous bucket (8 hits) is still
    // ~fully weighted because almost no time has elapsed in the new bucket.
    const firstOfNextBucket = evaluateSlidingWindow({
      currentCount: 1,
      previousCount: 8,
      nowSeconds: 600.1, // just after the boundary
      currentBucketIndex: 1,
      windowSeconds,
      limit,
    });
    expect(firstOfNextBucket.allowed).toBe(false);
    expect(firstOfNextBucket.weighted).toBeGreaterThan(limit);
  });

  it('decays the previous bucket weight as time passes within the current bucket', () => {
    // Halfway through the current bucket, the previous bucket's 8 hits count
    // for ~half: 8 * 0.5 = 4. So a currentCount of 4 (total weighted ~8) is
    // still allowed, but 5 (weighted ~9) is not.
    const halfway = evaluateSlidingWindow({
      currentCount: 4,
      previousCount: 8,
      nowSeconds: 300, // windowSeconds/2 into bucket 0
      currentBucketIndex: 0,
      windowSeconds,
      limit,
    });
    expect(halfway.weighted).toBeCloseTo(8, 1);
    expect(halfway.allowed).toBe(true);

    const halfwayOver = evaluateSlidingWindow({
      currentCount: 5,
      previousCount: 8,
      nowSeconds: 300,
      currentBucketIndex: 0,
      windowSeconds,
      limit,
    });
    expect(halfwayOver.allowed).toBe(false);
  });

  it('fully forgets the previous bucket once the current bucket is nearly over', () => {
    // Leave real headroom below the limit (4, not 8) — at the very tail of
    // the bucket previousWeight is only ~zero, not exactly zero, so testing
    // right at the limit would be a coin flip on floating-point residue.
    const nearEnd = evaluateSlidingWindow({
      currentCount: 4,
      previousCount: 8,
      nowSeconds: 599.99,
      currentBucketIndex: 0,
      windowSeconds,
      limit,
    });
    expect(nearEnd.weighted).toBeCloseTo(4, 1);
    expect(nearEnd.allowed).toBe(true);
  });

  it('clamps elapsed time outside [0, windowSeconds] instead of producing a negative/inflated weight', () => {
    // nowSeconds before the bucket's own start (shouldn't happen in practice,
    // but the clamp must not let previousWeight exceed 1 or go negative).
    const beforeStart = evaluateSlidingWindow({
      currentCount: 1,
      previousCount: 8,
      nowSeconds: -10,
      currentBucketIndex: 0,
      windowSeconds,
      limit,
    });
    expect(beforeStart.weighted).toBeLessThanOrEqual(9);

    const wayPastEnd = evaluateSlidingWindow({
      currentCount: 1,
      previousCount: 8,
      nowSeconds: 10_000,
      currentBucketIndex: 0,
      windowSeconds,
      limit,
    });
    expect(wayPastEnd.weighted).toBeCloseTo(1, 5);
  });
});
