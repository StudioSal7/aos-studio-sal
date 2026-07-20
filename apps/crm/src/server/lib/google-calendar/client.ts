/**
 * Cliente HTTP da API Google (OAuth + Calendar v3), fetch manual sem SDK —
 * portado do padrão JARVIS (ba-hub). Nenhuma dependência nova.
 *
 * Só fala rede: nada de DB aqui (a persistência de tokens vive em account.ts).
 * Tokens nunca são logados.
 */

import type { EventDateTime, EventPayload, GoogleTokens, RawCalendarEvent } from './types';

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

// Getters lazy: build/testes não quebram sem env; em preview sem as vars a
// feature degrada para "não conectada".
function getClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!id) throw new Error('GOOGLE_CLIENT_ID não configurado');
  return id;
}

function getClientSecret(): string {
  const s = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!s) throw new Error('GOOGLE_CLIENT_SECRET não configurado');
  return s;
}

function getRedirectUri(): string {
  const r = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!r) throw new Error('GOOGLE_REDIRECT_URI não configurado');
  return r;
}

export class InvalidGrantError extends Error {
  readonly code = 'invalid_grant';
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    // offline + consent garantem refresh_token novo a cada (re)conexão.
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange falhou (HTTP ${res.status})`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  if (!data.refresh_token) {
    // Não deveria acontecer com prompt=consent, mas o upsert sem refresh
    // token deixaria a conta inutilizável em ~1h — falhar explícito.
    throw new Error('Google não retornou refresh_token');
  }

  const email = await getUserEmail(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope,
    email,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; tokenExpiresAt: Date }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    if (err.error === 'invalid_grant') {
      throw new InvalidGrantError('Refresh token revogado — reconectar a conta Google');
    }
    throw new Error(`Google token refresh falhou (HTTP ${res.status})`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/** Revoga o token junto ao Google (best-effort no disconnect). */
export async function revokeToken(token: string): Promise<void> {
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  });
}

async function getUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo falhou (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error('Google userinfo sem email');
  return data.email;
}

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

// Teto de segurança — uma semana com >5 páginas (>500 instâncias expandidas)
// indicaria algo fora do normal; evita loop infinito por resposta malformada.
const MAX_PAGES = 5;

export async function listWeekEvents(
  accessToken: string,
  timeMinIso: string,
  timeMaxIso: string,
): Promise<RawCalendarEvent[]> {
  const items: RawCalendarEvent[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      timeMin: timeMinIso,
      timeMax: timeMaxIso,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${CALENDAR_BASE}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Google Calendar list falhou (HTTP ${res.status})`);
    }

    const data = (await res.json()) as {
      items?: RawCalendarEvent[];
      nextPageToken?: string;
    };
    items.push(...(data.items ?? []));

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return items;
}

export interface CreateEventResult {
  eventId: string;
  meetLink: string | null;
}

export async function createEvent(
  accessToken: string,
  body: EventPayload,
): Promise<CreateEventResult> {
  // sendUpdates=all → Google envia o convite por email aos attendees.
  const res = await fetch(`${CALENDAR_BASE}?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Google Calendar create falhou (HTTP ${res.status})`);
  }

  const data = (await res.json()) as RawCalendarEvent;
  return { eventId: data.id, meetLink: getMeetUrl(data) };
}

export async function patchEventTime(
  accessToken: string,
  eventId: string,
  patch: { start: EventDateTime; end: EventDateTime },
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    },
  );

  if (!res.ok) {
    throw new Error(`Google Calendar patch falhou (HTTP ${res.status})`);
  }
}

export async function deleteEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(
    `${CALENDAR_BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  // 404/410: evento já apagado (ex.: à mão, direto na Google) — sucesso.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar delete falhou (HTTP ${res.status})`);
  }
}

export function getMeetUrl(event: RawCalendarEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const ep = event.conferenceData?.entryPoints?.find((e) =>
    e.uri.includes('meet.google.com'),
  );
  return ep?.uri ?? null;
}
