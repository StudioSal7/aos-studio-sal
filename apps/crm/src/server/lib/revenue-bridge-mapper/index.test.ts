import { describe, expect, it } from 'vitest';
import { mapHotmartSaleToEntry, mapLeadPaidToEntry } from './index';

describe('mapHotmartSaleToEntry', () => {
  it('mapeia venda aprovada como receita já liquidada (competência = caixa = purchasedAt)', () => {
    const purchasedAt = new Date('2026-07-10T14:30:00Z');
    const entry = mapHotmartSaleToEntry(
      { id: 'sale-1', purchasedAt, commissionCents: 12345 },
      'cat-hotmart',
      'acc-1',
    );

    expect(entry.kind).toBe('receita');
    expect(entry.amountCents).toBe(12345);
    expect(entry.competenceDate).toBe('2026-07-10');
    expect(entry.cashDate).toEqual(purchasedAt);
    expect(entry.status).toBe('liquidado');
    expect(entry.categoryId).toBe('cat-hotmart');
    expect(entry.accountId).toBe('acc-1');
    expect(entry.originSource).toBe('hotmart_sale');
    expect(entry.originHotmartSaleId).toBe('sale-1');
    expect(entry.originLeadId).toBeNull();
  });

  it('funciona sem conta default (accountId null)', () => {
    const entry = mapHotmartSaleToEntry(
      { id: 'sale-2', purchasedAt: new Date('2026-01-01T00:00:00Z'), commissionCents: 100 },
      'cat-hotmart',
      null,
    );
    expect(entry.accountId).toBeNull();
  });
});

describe('mapLeadPaidToEntry', () => {
  it('converte valorProposto (numeric string) pra centavos sem erro de arredondamento', () => {
    const entry = mapLeadPaidToEntry({ id: 'lead-1', valorProposto: '1500.00' }, '2026-07-01', 'cat-mentoria');
    expect(entry?.amountCents).toBe(150000);
  });

  it('lida com valores com centavos fracionários (ex: 1999.90)', () => {
    const entry = mapLeadPaidToEntry({ id: 'lead-2', valorProposto: '1999.90' }, '2026-07-01', 'cat-mentoria');
    expect(entry?.amountCents).toBe(199990);
  });

  it('não deixa artefato de ponto flutuante (ex: 10.1 * 100 classicamente vira 1009.99999...)', () => {
    const entry = mapLeadPaidToEntry({ id: 'lead-3', valorProposto: '10.10' }, '2026-07-01', 'cat-mentoria');
    expect(entry?.amountCents).toBe(1010);
    expect(Number.isInteger(entry?.amountCents)).toBe(true);
  });

  it('lançamento fica em_aberto com cashDate nulo (owner liquida ao receber)', () => {
    const entry = mapLeadPaidToEntry({ id: 'lead-4', valorProposto: '5000' }, '2026-07-15', 'cat-mentoria');
    expect(entry?.status).toBe('em_aberto');
    expect(entry?.cashDate).toBeNull();
    expect(entry?.originSource).toBe('lead_paid');
    expect(entry?.originLeadId).toBe('lead-4');
    expect(entry?.originHotmartSaleId).toBeNull();
  });

  it('usa a data de competência recebida (não a data atual)', () => {
    const entry = mapLeadPaidToEntry({ id: 'lead-5', valorProposto: '100' }, '2026-03-15', 'cat-mentoria');
    expect(entry?.competenceDate).toBe('2026-03-15');
  });

  it('retorna null se valorProposto for null (lead pago sem valor lançado)', () => {
    const entry = mapLeadPaidToEntry({ id: 'lead-6', valorProposto: null }, '2026-07-01', 'cat-mentoria');
    expect(entry).toBeNull();
  });

  it('retorna null se valorProposto for zero ou negativo', () => {
    expect(mapLeadPaidToEntry({ id: 'lead-7', valorProposto: '0' }, '2026-07-01', 'cat-mentoria')).toBeNull();
    expect(mapLeadPaidToEntry({ id: 'lead-8', valorProposto: '-100' }, '2026-07-01', 'cat-mentoria')).toBeNull();
  });

  it('retorna null se valorProposto não for um número válido', () => {
    expect(mapLeadPaidToEntry({ id: 'lead-9', valorProposto: 'abc' }, '2026-07-01', 'cat-mentoria')).toBeNull();
  });
});
