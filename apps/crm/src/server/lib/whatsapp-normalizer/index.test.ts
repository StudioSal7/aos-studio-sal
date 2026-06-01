import { describe, expect, it } from 'vitest';
import { normalizeWhatsapp, whatsappDigitsOnly } from './index';

describe('normalizeWhatsapp — formats reais do CSV legado', () => {
  it('normaliza BR com country code + espaço', () => {
    expect(normalizeWhatsapp('55 11999834487')).toEqual({
      ok: true,
      e164: '+5511999834487',
    });
  });

  it('normaliza BR sem separadores nem +', () => {
    expect(normalizeWhatsapp('5519996524949')).toEqual({
      ok: true,
      e164: '+5519996524949',
    });
  });

  it('normaliza Portugal (351)', () => {
    expect(normalizeWhatsapp('351 911990810')).toEqual({
      ok: true,
      e164: '+351911990810',
    });
  });

  it('normaliza EUA (1)', () => {
    expect(normalizeWhatsapp('1 6193194244')).toEqual({
      ok: true,
      e164: '+16193194244',
    });
  });

  it('normaliza Austrália (61)', () => {
    expect(normalizeWhatsapp('610406140141')).toEqual({
      ok: true,
      e164: '+610406140141',
    });
  });

  it('normaliza 11 dígitos como Brasil', () => {
    expect(normalizeWhatsapp('11999834487')).toEqual({
      ok: true,
      e164: '+5511999834487',
    });
  });

  it('normaliza 10 dígitos como Brasil (landline)', () => {
    expect(normalizeWhatsapp('1133334444')).toEqual({
      ok: true,
      e164: '+551133334444',
    });
  });
});

describe('normalizeWhatsapp — pontuação e espaços', () => {
  it('aceita parênteses', () => {
    expect(normalizeWhatsapp('(11) 99999-9999')).toEqual({
      ok: true,
      e164: '+5511999999999',
    });
  });

  it('aceita hífens', () => {
    expect(normalizeWhatsapp('11-99999-9999')).toEqual({
      ok: true,
      e164: '+5511999999999',
    });
  });

  it('aceita formato +55 explícito', () => {
    expect(normalizeWhatsapp('+55 11 99999-9999')).toEqual({
      ok: true,
      e164: '+5511999999999',
    });
  });

  it('aceita espaços em volta', () => {
    expect(normalizeWhatsapp('  5511999999999  ')).toEqual({
      ok: true,
      e164: '+5511999999999',
    });
  });
});

describe('normalizeWhatsapp — erros estruturados', () => {
  it('rejeita null', () => {
    expect(normalizeWhatsapp(null)).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejeita undefined', () => {
    expect(normalizeWhatsapp(undefined)).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejeita string vazia', () => {
    expect(normalizeWhatsapp('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejeita string só com espaços', () => {
    expect(normalizeWhatsapp('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejeita string sem dígitos', () => {
    expect(normalizeWhatsapp('abc-def-ghi')).toEqual({ ok: false, reason: 'empty' });
  });

  it('detecta notação científica do Excel (9,71971E+15)', () => {
    expect(normalizeWhatsapp('9,71971E+15')).toEqual({
      ok: false,
      reason: 'scientific_notation',
    });
  });

  it('detecta variação lowercase de notação científica', () => {
    expect(normalizeWhatsapp('1.23e+10')).toEqual({
      ok: false,
      reason: 'scientific_notation',
    });
  });

  it('rejeita números muito curtos (<10 dígitos)', () => {
    expect(normalizeWhatsapp('123456789')).toEqual({ ok: false, reason: 'too_short' });
  });

  it('rejeita números muito longos (>15 dígitos)', () => {
    expect(normalizeWhatsapp('1234567890123456')).toEqual({ ok: false, reason: 'too_long' });
  });
});

describe('whatsappDigitsOnly', () => {
  it('extrai apenas dígitos', () => {
    expect(whatsappDigitsOnly('+55 (11) 99999-9999')).toBe('5511999999999');
  });

  it('retorna string vazia pra null', () => {
    expect(whatsappDigitsOnly(null)).toBe('');
  });

  it('retorna string vazia pra undefined', () => {
    expect(whatsappDigitsOnly(undefined)).toBe('');
  });

  it('preserva ordem dos dígitos', () => {
    expect(whatsappDigitsOnly('abc123def456')).toBe('123456');
  });
});
