import { afterAll, describe, expect, it } from 'vitest';
import { backfillWindows } from './index';

// Integração (upsert idempotente) exige DATABASE_URL + migration 0017 aplicada —
// mesmo padrão do dedup-matcher: skip silencioso sem banco.
const hasDb = !!process.env.DATABASE_URL;

describe('meta-sync / backfillWindows (puro)', () => {
  it('fatia [since, until] em janelas de 30 dias inclusivos', () => {
    const windows = backfillWindows('2026-02-01', '2026-07-15');
    expect(windows[0]).toEqual({ since: '2026-02-01', until: '2026-03-02' });
    expect(windows[1]).toEqual({ since: '2026-03-03', until: '2026-04-01' });
    expect(windows.at(-1)).toEqual({ since: '2026-07-01', until: '2026-07-15' });
    // Sem gap nem overlap entre janelas consecutivas
    for (let i = 1; i < windows.length; i++) {
      const prevEnd = new Date(`${windows[i - 1]!.until}T00:00:00Z`);
      const nextStart = new Date(`${windows[i]!.since}T00:00:00Z`);
      expect(nextStart.getTime() - prevEnd.getTime()).toBe(24 * 3600 * 1000);
    }
  });

  it('janela menor que o chunk vira janela única', () => {
    expect(backfillWindows('2026-07-01', '2026-07-10')).toEqual([
      { since: '2026-07-01', until: '2026-07-10' },
    ]);
  });

  it('since único = janela de 1 dia', () => {
    expect(backfillWindows('2026-07-01', '2026-07-01')).toEqual([
      { since: '2026-07-01', until: '2026-07-01' },
    ]);
  });

  it('entrada inválida ou invertida → sem janelas', () => {
    expect(backfillWindows('2026-08-01', '2026-07-01')).toEqual([]);
    expect(backfillWindows('lixo', '2026-07-01')).toEqual([]);
  });
});

describe.skipIf(!hasDb)('meta-sync / upsert idempotente (integração)', () => {
  const AD_ID = `test-meta-sync-${Date.now()}`;

  function makeRow(overrides: Record<string, unknown> = {}) {
    return {
      date: '2020-01-01', // data antiga — nunca colide com dado real
      adId: AD_ID,
      campaignId: 'test-c1',
      campaignName: 'test frio',
      adsetId: 'test-s1',
      adsetName: 'test set',
      adName: 'AD-TEST',
      spendCents: 58642,
      impressions: 18269,
      reachDaily: 9000,
      linkClicks: 393,
      landingPageViews: 322,
      video3s: 5611,
      videoP25: 1000,
      videoP50: 500,
      videoP75: 250,
      videoP95: 100,
      purchases: 2,
      purchaseValueCents: 117906,
      actionsRaw: { actions: [], action_values: [] },
      ...overrides,
    };
  }

  afterAll(async () => {
    const { db } = await import('@repo/db/client');
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`DELETE FROM meta_insights_daily WHERE ad_id = ${AD_ID}`);
  });

  it('upsert 2x do mesmo payload não duplica nem altera totais; rename atualiza a MESMA linha', async () => {
    const { db } = await import('@repo/db/client');
    const { sql } = await import('drizzle-orm');
    const { upsertInsights } = await import('./index');

    await upsertInsights([makeRow()]);
    await upsertInsights([makeRow()]); // idempotência

    const first = await db.execute(
      sql`SELECT count(*)::int AS n, sum(spend_cents)::int AS spend FROM meta_insights_daily WHERE ad_id = ${AD_ID}`,
    );
    expect((first as unknown as Array<{ n: number; spend: number }>)[0]).toEqual({
      n: 1,
      spend: 58642,
    });

    // Rename do anúncio + spend novo → mesma linha, valores novos (excluded.* funciona)
    await upsertInsights([makeRow({ adName: 'AD-TEST-RENOMEADO', spendCents: 60000 })]);

    const after = await db.execute(
      sql`SELECT count(*)::int AS n, max(ad_name) AS name, sum(spend_cents)::int AS spend FROM meta_insights_daily WHERE ad_id = ${AD_ID}`,
    );
    expect((after as unknown as Array<{ n: number; name: string; spend: number }>)[0]).toEqual({
      n: 1,
      name: 'AD-TEST-RENOMEADO',
      spend: 60000,
    });
  });

  it('lote de 600 linhas passa pelo chunking (teto de parâmetros do driver)', async () => {
    const { db } = await import('@repo/db/client');
    const { sql } = await import('drizzle-orm');
    const { upsertInsights } = await import('./index');

    const rows = Array.from({ length: 600 }, (_, i) =>
      makeRow({ date: '2020-01-02', adId: `${AD_ID}-bulk-${i}` }),
    );
    const written = await upsertInsights(rows);
    expect(written).toBe(600);

    const count = await db.execute(
      sql`SELECT count(*)::int AS n FROM meta_insights_daily WHERE ad_id LIKE ${`${AD_ID}-bulk-%`}`,
    );
    expect((count as unknown as Array<{ n: number }>)[0]!.n).toBe(600);

    await db.execute(sql`DELETE FROM meta_insights_daily WHERE ad_id LIKE ${`${AD_ID}-bulk-%`}`);
  });
});
