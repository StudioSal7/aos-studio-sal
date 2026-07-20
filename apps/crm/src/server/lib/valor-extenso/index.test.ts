import { describe, expect, it } from 'vitest';
import { valorPorExtenso } from './index';

describe('valorPorExtenso', () => {
  it('zero', () => {
    expect(valorPorExtenso(0)).toBe('zero reais');
  });

  it('valor redondo (sem centavos)', () => {
    expect(valorPorExtenso(199700)).toBe('mil novecentos e noventa e sete reais');
    expect(valorPorExtenso(800000)).toBe('oito mil reais');
    expect(valorPorExtenso(3600000)).toBe('trinta e seis mil reais');
  });

  it('singular: um real', () => {
    expect(valorPorExtenso(100)).toBe('um real');
  });

  it('singular: um centavo', () => {
    expect(valorPorExtenso(1)).toBe('um centavo');
  });

  it('com centavos (plural)', () => {
    expect(valorPorExtenso(199750)).toBe('mil novecentos e noventa e sete reais e cinquenta centavos');
  });

  it('reais + um centavo (singular misto)', () => {
    expect(valorPorExtenso(101)).toBe('um real e um centavo');
  });

  it('dezenas com "e" (11-19 são exceção lexical)', () => {
    expect(valorPorExtenso(1500)).toBe('quinze reais');
    expect(valorPorExtenso(2100)).toBe('vinte e um reais');
  });

  it('centena exata usa "e" antes do resto (mil e duzentos)', () => {
    expect(valorPorExtenso(120000)).toBe('mil e duzentos reais');
  });

  it('centena exata usa "cem" (não "cento") quando sozinha', () => {
    expect(valorPorExtenso(10000)).toBe('cem reais');
  });

  it('centena composta com dezena/unidade não usa "e" antes do "mil" (concatena)', () => {
    expect(valorPorExtenso(123500)).toBe('mil duzentos e trinta e cinco reais');
  });

  it('milhares compostos (dezenas/centenas de milhar)', () => {
    expect(valorPorExtenso(3600000)).toBe('trinta e seis mil reais');
    expect(valorPorExtenso(800000)).toBe('oito mil reais');
    // 350 não é múltiplo de 100 nem < 100 → sem "e" antes do resto (concatena, como em "mil duzentos e trinta e cinco")
    expect(valorPorExtenso(1235000)).toBe('doze mil trezentos e cinquenta reais');
  });

  it('centavos com dezena (21-99 usa "e" interno)', () => {
    // 500 é múltiplo de 100 → usa "e" antes do resto ("mil e quinhentos")
    expect(valorPorExtenso(150021)).toBe('mil e quinhentos reais e vinte e um centavos');
  });

  it('valor negativo trata como magnitude (nunca deveria ocorrer em dinheiro, mas não quebra)', () => {
    expect(valorPorExtenso(-100)).toBe('um real');
  });

  it('arredonda cents fracionários (defensivo)', () => {
    expect(valorPorExtenso(100.4)).toBe('um real');
  });
});
