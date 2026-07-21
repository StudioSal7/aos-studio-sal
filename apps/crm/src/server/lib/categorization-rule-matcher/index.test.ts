import { describe, expect, it } from 'vitest';
import { matchCategorizationRule } from './index';

describe('matchCategorizationRule', () => {
  it('casa por substring, case-insensitive', () => {
    const result = matchCategorizationRule('PAGAMENTO NETFLIX.COM', [
      { pattern: 'netflix', categoryId: 'cat-streaming', priority: 0 },
    ]);
    expect(result).toBe('cat-streaming');
  });

  it('retorna null quando nenhuma regra casa', () => {
    const result = matchCategorizationRule('TRANSFERENCIA QUALQUER', [
      { pattern: 'netflix', categoryId: 'cat-streaming', priority: 0 },
    ]);
    expect(result).toBeNull();
  });

  it('retorna null pra lista de regras vazia', () => {
    expect(matchCategorizationRule('qualquer coisa', [])).toBeNull();
  });

  it('prioridade maior é checada primeiro quando mais de uma regra casaria', () => {
    const result = matchCategorizationRule('PAGAMENTO AWS AMAZON', [
      { pattern: 'amazon', categoryId: 'cat-generico', priority: 0 },
      { pattern: 'aws', categoryId: 'cat-infra', priority: 10 },
    ]);
    expect(result).toBe('cat-infra');
  });

  it('ignora regras com pattern vazio', () => {
    const result = matchCategorizationRule('teste', [
      { pattern: '', categoryId: 'cat-x', priority: 100 },
      { pattern: 'teste', categoryId: 'cat-y', priority: 0 },
    ]);
    expect(result).toBe('cat-y');
  });

  it('é determinístico', () => {
    const rules = [{ pattern: 'x', categoryId: 'cat-1', priority: 0 }];
    expect(matchCategorizationRule('teste x', rules)).toBe(matchCategorizationRule('teste x', rules));
  });
});
