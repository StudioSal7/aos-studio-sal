/**
 * Conta Google ativa + access token válido (refresh transparente).
 *
 * Único arquivo do módulo que toca o banco. Tokens circulam SÓ server-side —
 * nunca retornar refresh token a callers, nunca logar.
 */

import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { InvalidGrantError, refreshAccessToken } from './client';
import { isTokenExpiring } from './token';

export type ActiveAccountResult =
  | {
      ok: true;
      account: { id: string; googleEmail: string };
      accessToken: string;
    }
  | { ok: false; reason: 'not_connected' | 'invalid_grant' | 'refresh_failed' };

export async function getActiveAccountWithToken(): Promise<ActiveAccountResult> {
  // v1: a única conta ativa (Renata). Multi-conta depois muda só esta seleção.
  const [account] = await db
    .select({
      id: schema.googleAccounts.id,
      googleEmail: schema.googleAccounts.googleEmail,
      accessToken: schema.googleAccounts.accessToken,
      refreshToken: schema.googleAccounts.refreshToken,
      tokenExpiresAt: schema.googleAccounts.tokenExpiresAt,
    })
    .from(schema.googleAccounts)
    .where(
      and(
        eq(schema.googleAccounts.isActive, true),
        isNotNull(schema.googleAccounts.refreshToken),
      ),
    )
    .orderBy(schema.googleAccounts.createdAt)
    .limit(1);

  if (!account?.refreshToken) {
    return { ok: false, reason: 'not_connected' };
  }

  if (account.accessToken && !isTokenExpiring(account.tokenExpiresAt)) {
    return {
      ok: true,
      account: { id: account.id, googleEmail: account.googleEmail },
      accessToken: account.accessToken,
    };
  }

  try {
    const refreshed = await refreshAccessToken(account.refreshToken);
    await db
      .update(schema.googleAccounts)
      .set({
        accessToken: refreshed.accessToken,
        tokenExpiresAt: refreshed.tokenExpiresAt,
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.googleAccounts.id, account.id));

    return {
      ok: true,
      account: { id: account.id, googleEmail: account.googleEmail },
      accessToken: refreshed.accessToken,
    };
  } catch (err) {
    if (err instanceof InvalidGrantError) {
      // Conta precisa reconectar — sai da seleção até o owner reautenticar.
      await db
        .update(schema.googleAccounts)
        .set({
          isActive: false,
          lastSyncError: 'invalid_grant',
          updatedAt: new Date(),
        })
        .where(eq(schema.googleAccounts.id, account.id));
      return { ok: false, reason: 'invalid_grant' };
    }
    return { ok: false, reason: 'refresh_failed' };
  }
}
