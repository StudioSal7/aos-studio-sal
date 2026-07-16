/** Lógica pura de expiração de access token. */

const DEFAULT_SKEW_MS = 5 * 60_000;

/**
 * true se o token está vencido ou vence dentro da janela de folga (5min) —
 * ou se não há expiração conhecida (força refresh).
 */
export function isTokenExpiring(
  tokenExpiresAt: Date | null,
  now: Date = new Date(),
  skewMs: number = DEFAULT_SKEW_MS,
): boolean {
  if (!tokenExpiresAt) return true;
  return tokenExpiresAt.getTime() <= now.getTime() + skewMs;
}
