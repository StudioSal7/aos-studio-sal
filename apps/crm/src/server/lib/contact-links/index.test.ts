import { describe, expect, it } from 'vitest';
import { buildInstagramLink, buildMailtoLink, buildWhatsAppLink } from './index';

describe('buildMailtoLink', () => {
  it('monta mailto: quando há e-mail', () => {
    expect(buildMailtoLink('layla@example.com')).toBe('mailto:layla@example.com');
  });

  it('retorna null para null/undefined/vazio', () => {
    expect(buildMailtoLink(null)).toBeNull();
    expect(buildMailtoLink(undefined)).toBeNull();
    expect(buildMailtoLink('')).toBeNull();
    expect(buildMailtoLink('   ')).toBeNull();
  });
});

describe('buildWhatsAppLink', () => {
  it('monta wa.me só com dígitos a partir de E.164', () => {
    expect(buildWhatsAppLink('+5511999834487')).toBe('https://wa.me/5511999834487');
  });

  it('remove espaços, parênteses e traços', () => {
    expect(buildWhatsAppLink('+55 (11) 99983-4487')).toBe('https://wa.me/5511999834487');
  });

  it('retorna null para null/undefined/vazio/sem dígitos', () => {
    expect(buildWhatsAppLink(null)).toBeNull();
    expect(buildWhatsAppLink(undefined)).toBeNull();
    expect(buildWhatsAppLink('')).toBeNull();
    expect(buildWhatsAppLink('+()-')).toBeNull();
  });
});

describe('buildInstagramLink', () => {
  it('monta instagram.com/<handle> removendo o @', () => {
    expect(buildInstagramLink('@laylarocha.__')).toBe('https://instagram.com/laylarocha.__');
  });

  it('funciona sem @ também', () => {
    expect(buildInstagramLink('laylarocha.__')).toBe('https://instagram.com/laylarocha.__');
  });

  it('retorna null para null/undefined/vazio/só @', () => {
    expect(buildInstagramLink(null)).toBeNull();
    expect(buildInstagramLink(undefined)).toBeNull();
    expect(buildInstagramLink('')).toBeNull();
    expect(buildInstagramLink('@')).toBeNull();
  });
});
