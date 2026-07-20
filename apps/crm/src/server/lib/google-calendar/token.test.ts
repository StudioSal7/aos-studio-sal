import { describe, expect, it } from 'vitest';
import { isTokenExpiring } from './token';

const NOW = new Date('2026-07-16T12:00:00.000Z');

describe('isTokenExpiring', () => {
  it('token vencido → true', () => {
    expect(isTokenExpiring(new Date('2026-07-16T11:00:00.000Z'), NOW)).toBe(true);
  });

  it('vence dentro da janela de 5min → true', () => {
    expect(isTokenExpiring(new Date('2026-07-16T12:03:00.000Z'), NOW)).toBe(true);
  });

  it('exatamente na borda da janela → true (<=)', () => {
    expect(isTokenExpiring(new Date('2026-07-16T12:05:00.000Z'), NOW)).toBe(true);
  });

  it('token fresco → false', () => {
    expect(isTokenExpiring(new Date('2026-07-16T12:50:00.000Z'), NOW)).toBe(false);
  });

  it('sem expiração conhecida (null) → true (força refresh)', () => {
    expect(isTokenExpiring(null, NOW)).toBe(true);
  });
});
