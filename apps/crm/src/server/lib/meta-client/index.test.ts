import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MetaUsageAbortError, fetchAdInsights } from './index';

const ENV_BACKUP = {
  token: process.env.META_ACCESS_TOKEN,
  account: process.env.META_AD_ACCOUNT_ID,
};

beforeAll(() => {
  process.env.META_ACCESS_TOKEN = 'test-token';
  process.env.META_AD_ACCOUNT_ID = 'act_123456'; // com prefixo de propósito — o client remove
});

afterAll(() => {
  process.env.META_ACCESS_TOKEN = ENV_BACKUP.token;
  process.env.META_AD_ACCOUNT_ID = ENV_BACKUP.account;
});

function jsonResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const ROW = {
  date_start: '2026-07-10',
  date_stop: '2026-07-10',
  campaign_id: 'c1',
  campaign_name: 'camp',
  adset_id: 's1',
  adset_name: 'set',
  ad_id: 'a1',
  ad_name: 'AD01',
};

describe('meta-client / fetchAdInsights', () => {
  it('segue paging.next até esgotar (2 páginas)', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      const u = String(url);
      calls.push(u);
      if (calls.length === 1) {
        return jsonResponse({ data: [ROW], paging: { next: 'https://graph.facebook.com/next-page' } });
      }
      return jsonResponse({ data: [{ ...ROW, ad_id: 'a2' }] });
    }) as typeof fetch;

    const rows = await fetchAdInsights({ since: '2026-07-01', until: '2026-07-10', fetchImpl });

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.ad_id)).toEqual(['a1', 'a2']);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toBe('https://graph.facebook.com/next-page');
  });

  it('prepende act_ ao account id (e tolera env já com prefixo)', async () => {
    let requested = '';
    const fetchImpl = (async (url: string | URL | Request) => {
      requested = String(url);
      return jsonResponse({ data: [] });
    }) as typeof fetch;

    await fetchAdInsights({ since: '2026-07-01', until: '2026-07-10', fetchImpl });

    expect(requested).toContain('/act_123456/insights');
    expect(requested).not.toContain('act_act_');
    expect(requested).toContain('level=ad');
    expect(requested).toContain('time_increment=1');
  });

  it('uso ≥80% com próxima página pendente → MetaUsageAbortError', async () => {
    const fetchImpl = (async () =>
      jsonResponse(
        { data: [ROW], paging: { next: 'https://graph.facebook.com/next' } },
        { 'X-Business-Use-Case-Usage': JSON.stringify({ '123': [{ call_count: 85, total_cputime: 10, total_time: 10 }] }) },
      )) as typeof fetch;

    await expect(
      fetchAdInsights({ since: '2026-07-01', until: '2026-07-10', fetchImpl }),
    ).rejects.toThrow(MetaUsageAbortError);
  });

  it('uso ≥80% na ÚLTIMA página não aborta (página corrente é aproveitada)', async () => {
    const fetchImpl = (async () =>
      jsonResponse(
        { data: [ROW] },
        { 'X-Business-Use-Case-Usage': JSON.stringify({ '123': [{ call_count: 90 }] }) },
      )) as typeof fetch;

    const rows = await fetchAdInsights({ since: '2026-07-01', until: '2026-07-10', fetchImpl });
    expect(rows).toHaveLength(1);
  });

  it('erro da API vira Error com código e mensagem', async () => {
    const fetchImpl = (async () =>
      jsonResponse({ error: { code: 190, message: 'Invalid OAuth access token' } })) as typeof fetch;

    await expect(
      fetchAdInsights({ since: '2026-07-01', until: '2026-07-10', fetchImpl }),
    ).rejects.toThrow(/Meta API error \[190\]/);
  });
});
