import { describe, expect, it } from 'vitest';
import { buildDre } from './index';

describe('buildDre', () => {
  it('período vazio: tudo zero', () => {
    const result = buildDre([]);
    expect(result.receitaLiquidaCents).toBe(0);
    expect(result.lucroBrutoCents).toBe(0);
    expect(result.resultadoLiquidoCents).toBe(0);
    expect(result.sections.every((s) => s.totalCents === 0)).toBe(true);
  });

  it('receita só: receita líquida = lucro bruto = resultado líquido = receita bruta', () => {
    const result = buildDre([{ kind: 'receita', dreSection: 'receita_bruta', amountCents: 10000 }]);
    expect(result.sections.find((s) => s.section === 'receita_bruta')?.totalCents).toBe(10000);
    expect(result.receitaLiquidaCents).toBe(10000);
    expect(result.lucroBrutoCents).toBe(10000);
    expect(result.resultadoLiquidoCents).toBe(10000);
  });

  it('receita − dedução: reduz receita líquida e propaga pros subtotais seguintes', () => {
    const result = buildDre([
      { kind: 'receita', dreSection: 'receita_bruta', amountCents: 10000 },
      { kind: 'despesa', dreSection: 'deducao', amountCents: 1000 },
    ]);
    expect(result.receitaLiquidaCents).toBe(9000);
    expect(result.lucroBrutoCents).toBe(9000);
    expect(result.resultadoLiquidoCents).toBe(9000);
  });

  it('com imposto: reduz receita líquida além da dedução', () => {
    const result = buildDre([
      { kind: 'receita', dreSection: 'receita_bruta', amountCents: 10000 },
      { kind: 'despesa', dreSection: 'deducao', amountCents: 1000 },
      { kind: 'despesa', dreSection: 'imposto', amountCents: 500 },
    ]);
    expect(result.receitaLiquidaCents).toBe(8500);
    expect(result.lucroBrutoCents).toBe(8500);
    expect(result.resultadoLiquidoCents).toBe(8500);
  });

  it('com custos: reduz lucro bruto e resultado líquido, não a receita líquida', () => {
    const result = buildDre([
      { kind: 'receita', dreSection: 'receita_bruta', amountCents: 10000 },
      { kind: 'despesa', dreSection: 'custo', amountCents: 3000 },
    ]);
    expect(result.receitaLiquidaCents).toBe(10000);
    expect(result.lucroBrutoCents).toBe(7000);
    expect(result.resultadoLiquidoCents).toBe(7000);
  });

  it('com despesas fixas e variáveis: reduz só o resultado líquido, não o lucro bruto', () => {
    const result = buildDre([
      { kind: 'receita', dreSection: 'receita_bruta', amountCents: 10000 },
      { kind: 'despesa', dreSection: 'custo', amountCents: 2000 },
      { kind: 'despesa', dreSection: 'despesa_fixa', amountCents: 1500 },
      { kind: 'despesa', dreSection: 'despesa_variavel', amountCents: 500 },
    ]);
    expect(result.lucroBrutoCents).toBe(8000);
    expect(result.resultadoLiquidoCents).toBe(6000);
  });

  it('soma múltiplos lançamentos da mesma seção', () => {
    const result = buildDre([
      { kind: 'receita', dreSection: 'receita_bruta', amountCents: 5000 },
      { kind: 'receita', dreSection: 'receita_bruta', amountCents: 3000 },
    ]);
    expect(result.sections.find((s) => s.section === 'receita_bruta')?.totalCents).toBe(8000);
  });

  it('resultado líquido pode ficar negativo (prejuízo)', () => {
    const result = buildDre([
      { kind: 'receita', dreSection: 'receita_bruta', amountCents: 1000 },
      { kind: 'despesa', dreSection: 'despesa_fixa', amountCents: 5000 },
    ]);
    expect(result.resultadoLiquidoCents).toBe(-4000);
  });

  it('seção "outra" com despesa reduz só o resultado líquido', () => {
    const result = buildDre([
      { kind: 'receita', dreSection: 'receita_bruta', amountCents: 10000 },
      { kind: 'despesa', dreSection: 'outra', amountCents: 200 },
    ]);
    expect(result.receitaLiquidaCents).toBe(10000);
    expect(result.lucroBrutoCents).toBe(10000);
    expect(result.resultadoLiquidoCents).toBe(9800);
  });

  it('lançamentos são independentes do banco (função pura, sem I/O)', () => {
    // Garantia estrutural: chamar 2x com o mesmo input dá o mesmo resultado.
    const input = [{ kind: 'receita' as const, dreSection: 'receita_bruta' as const, amountCents: 100 }];
    expect(buildDre(input)).toEqual(buildDre(input));
  });
});
