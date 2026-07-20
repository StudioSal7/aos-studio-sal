import { describe, expect, it } from 'vitest';
import { centsFromReaisInput, formatCents, reaisInputFromCents } from './money';

describe('centsFromReaisInput', () => {
  it('converte string decimal em reais para integer cents', () => {
    expect(centsFromReaisInput('1997.00')).toBe(199700);
    expect(centsFromReaisInput('5000')).toBe(500000);
  });

  it('aceita vírgula como separador decimal', () => {
    expect(centsFromReaisInput('1997,50')).toBe(199750);
  });

  it('arredonda centavos fracionários', () => {
    expect(centsFromReaisInput('10.005')).toBe(1001);
  });

  it('retorna null para string vazia ou inválida — sem chute', () => {
    expect(centsFromReaisInput('')).toBeNull();
    expect(centsFromReaisInput('   ')).toBeNull();
    expect(centsFromReaisInput('abc')).toBeNull();
  });
});

describe('reaisInputFromCents', () => {
  it('converte integer cents para string decimal em reais', () => {
    expect(reaisInputFromCents(199700)).toBe('1997.00');
    expect(reaisInputFromCents(500000)).toBe('5000.00');
  });

  it('retorna string vazia para null/undefined — permanece editável no form', () => {
    expect(reaisInputFromCents(null)).toBe('');
    expect(reaisInputFromCents(undefined)).toBe('');
  });
});

describe('formatCents', () => {
  it('formata cents como BRL para exibição', () => {
    expect(formatCents(199700)).toBe('R$ 1.997,00');
  });

  it('mostra travessão para valor ausente — nunca inventa preço', () => {
    expect(formatCents(null)).toBe('—');
    expect(formatCents(undefined)).toBe('—');
  });
});
