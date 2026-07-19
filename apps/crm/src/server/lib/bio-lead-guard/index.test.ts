import { describe, expect, it } from 'vitest';
import {
  buildEnrichPatch,
  findPayloadCapViolation,
  getTrustedClientIp,
  resolveAllowedSourceSlug,
} from './index';

function headers(values: Record<string, string>): { get(name: string): string | null } {
  return { get: (name) => values[name] ?? null };
}

describe('getTrustedClientIp', () => {
  it('uses x-real-ip when present, ignoring x-forwarded-for entirely', () => {
    const ip = getTrustedClientIp(
      headers({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }),
    );
    expect(ip).toBe('203.0.113.9');
  });

  it('never trusts the leftmost (attacker-controlled) x-forwarded-for hop', () => {
    // Attacker prepends an arbitrary IP; the platform-appended real IP is the last hop.
    const ip = getTrustedClientIp(
      headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 203.0.113.9' }),
    );
    expect(ip).toBe('203.0.113.9');
    expect(ip).not.toBe('1.2.3.4');
  });

  it('falls back to the last x-forwarded-for hop when x-real-ip is absent', () => {
    const ip = getTrustedClientIp(headers({ 'x-forwarded-for': '203.0.113.9' }));
    expect(ip).toBe('203.0.113.9');
  });

  it('returns "unknown" when no IP header is present', () => {
    expect(getTrustedClientIp(headers({}))).toBe('unknown');
  });

  it('ignores a blank x-real-ip and falls back to x-forwarded-for', () => {
    const ip = getTrustedClientIp(headers({ 'x-real-ip': '   ', 'x-forwarded-for': '203.0.113.9' }));
    expect(ip).toBe('203.0.113.9');
  });
});

describe('findPayloadCapViolation', () => {
  it('accepts a payload within all limits', () => {
    expect(
      findPayloadCapViolation({
        nome: 'Maria',
        email: 'maria@example.com',
        resumo: 'um resumo curto',
        respostas: { faturamento: 'ate_5k' },
        utm: { utm_source: 'instagram' },
      }),
    ).toBeNull();
  });

  it('rejects an oversized nome', () => {
    const violation = findPayloadCapViolation({ nome: 'x'.repeat(201) });
    expect(violation).toEqual({ field: 'nome', limit: 200 });
  });

  it('rejects an oversized resumo (notes-bloat vector)', () => {
    const violation = findPayloadCapViolation({ resumo: 'x'.repeat(4001) });
    expect(violation).toEqual({ field: 'resumo', limit: 4000 });
  });

  it('rejects an oversized UTM field', () => {
    const violation = findPayloadCapViolation({ utm: { utm_campaign: 'x'.repeat(257) } });
    expect(violation).toEqual({ field: 'utm.utm_campaign', limit: 256 });
  });

  it('rejects an oversized respostas.faturamento', () => {
    const violation = findPayloadCapViolation({ respostas: { faturamento: 'x'.repeat(101) } });
    expect(violation).toEqual({ field: 'respostas.faturamento', limit: 100 });
  });

  it('accepts a field exactly at the limit (boundary)', () => {
    expect(findPayloadCapViolation({ nome: 'x'.repeat(200) })).toBeNull();
  });
});

describe('resolveAllowedSourceSlug', () => {
  it('accepts the seeded bio-quiz slug', () => {
    expect(resolveAllowedSourceSlug('bio-quiz')).toBe('bio-quiz');
  });

  it('clamps an unrecognized/attacker-supplied slug to the default', () => {
    expect(resolveAllowedSourceSlug('giu_salvatore_indicacao')).toBe('bio-quiz');
    expect(resolveAllowedSourceSlug('indicacao_pessoal')).toBe('bio-quiz');
    expect(resolveAllowedSourceSlug('made-up-slug')).toBe('bio-quiz');
  });

  it('clamps an undefined slug to the default', () => {
    expect(resolveAllowedSourceSlug(undefined)).toBe('bio-quiz');
  });
});

describe('buildEnrichPatch', () => {
  const emptyExisting = {
    notes: null,
    produtoInteresseId: null,
    rendaFaixa: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
  };

  it('fills every field when the existing lead has none set', () => {
    const patch = buildEnrichPatch(emptyExisting, {
      produtoInteresseId: 'prod-1',
      rendaFaixa: 'ate_5k',
      utmSource: 'instagram',
      utmMedium: 'bio',
      utmCampaign: 'launch',
      utmTerm: 'term',
      utmContent: 'content',
    });
    expect(patch).toEqual({
      produtoInteresseId: 'prod-1',
      rendaFaixa: 'ate_5k',
      utmSource: 'instagram',
      utmMedium: 'bio',
      utmCampaign: 'launch',
      utmTerm: 'term',
      utmContent: 'content',
    });
  });

  it('never overwrites a non-empty existing field (the core protection)', () => {
    const existing = {
      ...emptyExisting,
      rendaFaixa: 'de R$20.000 a R$30.000 por mês', // qualified Respondi income
      utmSource: 'instagram', // original attribution
    };
    const patch = buildEnrichPatch(existing, {
      rendaFaixa: 'PWNED',
      utmSource: 'spam',
      utmCampaign: 'spam-campaign', // this one IS empty on existing → should fill
    });
    expect(patch.rendaFaixa).toBeUndefined();
    expect(patch.utmSource).toBeUndefined();
    expect(patch.utmCampaign).toBe('spam-campaign');
  });

  it('leaves produtoInteresseId untouched when already set (fill-if-empty semantics)', () => {
    const existing = { ...emptyExisting, produtoInteresseId: 'existing-prod' };
    const patch = buildEnrichPatch(existing, { produtoInteresseId: 'attacker-prod' });
    expect(patch.produtoInteresseId).toBeUndefined();
  });

  it('returns an empty patch when nothing incoming and nothing to fill', () => {
    expect(buildEnrichPatch(emptyExisting, {})).toEqual({});
  });

  it('never includes requiresAttention — the return type has no such key by construction', () => {
    const patch = buildEnrichPatch(emptyExisting, {
      produtoInteresseId: 'prod-1',
      rendaFaixa: 'ate_5k',
    });
    expect(patch).not.toHaveProperty('requiresAttention');
    expect(patch).not.toHaveProperty('requiresAttentionReason');
  });
});
