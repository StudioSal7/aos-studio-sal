import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvalidGrantError, deleteEvent, listWeekEvents, refreshAccessToken } from './client';
import type { RawCalendarEvent } from './types';

function mockFetchOnce(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

function mockFetchSequence(bodies: unknown[]) {
  const fn = vi.fn();
  for (const body of bodies) {
    fn.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
  vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://localhost:3000/api/google/oauth/callback');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('refreshAccessToken', () => {
  it('invalid_grant vira InvalidGrantError (sinal de reconectar)', async () => {
    mockFetchOnce(400, { error: 'invalid_grant' });
    await expect(refreshAccessToken('rt')).rejects.toBeInstanceOf(InvalidGrantError);
  });

  it('erro genérico NÃO vira InvalidGrantError', async () => {
    mockFetchOnce(500, { error: 'internal' });
    const err = await refreshAccessToken('rt').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(InvalidGrantError);
  });

  it('sucesso retorna token novo com expiração futura', async () => {
    mockFetchOnce(200, { access_token: 'at-new', expires_in: 3600 });
    const before = Date.now();
    const r = await refreshAccessToken('rt');
    expect(r.accessToken).toBe('at-new');
    expect(r.tokenExpiresAt.getTime()).toBeGreaterThan(before);
  });
});

describe('listWeekEvents', () => {
  function ev(id: string): RawCalendarEvent {
    return { id, summary: id, start: { dateTime: '2026-07-13T12:00:00.000Z' } };
  }

  it('página única (sem nextPageToken) retorna os itens direto', async () => {
    mockFetchOnce(200, { items: [ev('a'), ev('b')] });
    const items = await listWeekEvents('at', '2026-07-13T00:00:00Z', '2026-07-20T00:00:00Z');
    expect(items.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('segue nextPageToken e acumula todas as páginas', async () => {
    const fn = mockFetchSequence([
      { items: [ev('a')], nextPageToken: 'p2' },
      { items: [ev('b')], nextPageToken: 'p3' },
      { items: [ev('c')] },
    ]);
    const items = await listWeekEvents('at', '2026-07-13T00:00:00Z', '2026-07-20T00:00:00Z');
    expect(items.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(fn).toHaveBeenCalledTimes(3);
    // 2ª e 3ª chamadas carregam o pageToken da página anterior
    expect(String(fn.mock.calls[1]?.[0])).toContain('pageToken=p2');
    expect(String(fn.mock.calls[2]?.[0])).toContain('pageToken=p3');
  });

  it('para no teto de páginas mesmo se o Google devolver nextPageToken pra sempre', async () => {
    const fn = vi.fn().mockImplementation(
      () => Promise.resolve(new Response(JSON.stringify({ items: [ev('x')], nextPageToken: 'more' }), { status: 200 })),
    );
    vi.stubGlobal('fetch', fn);
    const items = await listWeekEvents('at', '2026-07-13T00:00:00Z', '2026-07-20T00:00:00Z');
    expect(fn).toHaveBeenCalledTimes(5); // MAX_PAGES
    expect(items).toHaveLength(5);
  });
});

describe('deleteEvent', () => {
  it('404 (evento já apagado à mão) é tratado como sucesso', async () => {
    mockFetchOnce(404, {});
    await expect(deleteEvent('at', 'evt')).resolves.toBeUndefined();
  });

  it('410 também é sucesso', async () => {
    mockFetchOnce(410, {});
    await expect(deleteEvent('at', 'evt')).resolves.toBeUndefined();
  });

  it('erro real (500) lança', async () => {
    mockFetchOnce(500, {});
    await expect(deleteEvent('at', 'evt')).rejects.toThrow();
  });
});
