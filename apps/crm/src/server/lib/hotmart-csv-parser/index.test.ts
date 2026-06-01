import { describe, expect, it } from 'vitest';
import {
  deriveTrafficType,
  normalizeCommission,
  normalizeStatus,
  parseHotmartCsvRow,
  parseHotmartCsvText,
  parseHotmartDate,
} from './index';

describe('normalizeCommission', () => {
  it('handles dot as decimal separator', () => {
    expect(normalizeCommission('588.1')).toBe(58810);
    expect(normalizeCommission('122.49')).toBe(12249);
    expect(normalizeCommission('44.99')).toBe(4499);
  });

  it('handles comma as decimal separator (Brazilian)', () => {
    expect(normalizeCommission('588,1')).toBe(58810);
    expect(normalizeCommission('23,8')).toBe(2380);
  });

  it('handles integer (no separator)', () => {
    expect(normalizeCommission('588')).toBe(58800);
  });

  it('handles Brazilian thousand+decimal format', () => {
    expect(normalizeCommission('1.234,56')).toBe(123456);
  });

  it('strips surrounding whitespace', () => {
    expect(normalizeCommission(' 588.1 ')).toBe(58810);
  });

  it('throws on empty', () => {
    expect(() => normalizeCommission('')).toThrow('empty');
    expect(() => normalizeCommission('   ')).toThrow('empty');
  });

  it('throws on non-numeric', () => {
    expect(() => normalizeCommission('abc')).toThrow('invalid_number');
  });
});

describe('normalizeStatus', () => {
  it('maps PURCHASE_APPROVED to approved', () => {
    expect(normalizeStatus('PURCHASE_APPROVED')).toBe('approved');
    expect(normalizeStatus('purchase_approved')).toBe('approved');
  });

  it('maps "teste completo" to test', () => {
    expect(normalizeStatus('teste completo')).toBe('test');
    expect(normalizeStatus('TESTE COMPLETO')).toBe('test');
  });

  it('detects refund variants', () => {
    expect(normalizeStatus('PURCHASE_REFUNDED')).toBe('refunded');
    expect(normalizeStatus('REEMBOLSO')).toBe('refunded');
    expect(normalizeStatus('ESTORNADO')).toBe('refunded');
  });

  it('detects cancel variants', () => {
    expect(normalizeStatus('PURCHASE_CANCELED')).toBe('cancelled');
    expect(normalizeStatus('CANCELADA')).toBe('cancelled');
  });

  it('falls back to other for unknown status', () => {
    expect(normalizeStatus('SOME_NEW_STATUS')).toBe('other');
    expect(normalizeStatus('')).toBe('other');
  });
});

describe('parseHotmartDate', () => {
  it('parses DD-MM-YYYY HH:MM as São Paulo time and converts to UTC', () => {
    // 27-03-2026 02:55 BRT (UTC-3) → 27-03-2026 05:55 UTC
    const d = parseHotmartDate('27-03-2026 02:55');
    expect(d.toISOString()).toBe('2026-03-27T05:55:00.000Z');
  });

  it('handles midnight-adjacent times correctly', () => {
    // 31-03-2026 21:34 BRT → 01-04-2026 00:34 UTC
    const d = parseHotmartDate('31-03-2026 21:34');
    expect(d.toISOString()).toBe('2026-04-01T00:34:00.000Z');
  });

  it('throws on invalid format', () => {
    expect(() => parseHotmartDate('2026-03-27')).toThrow('invalid_date_format');
    expect(() => parseHotmartDate('27/03/2026 02:55')).toThrow('invalid_date_format');
  });
});

describe('deriveTrafficType', () => {
  it('classifies cpc as paid', () => {
    expect(deriveTrafficType('cpc', 'meta')).toBe('paid');
    expect(deriveTrafficType('CPC', 'meta')).toBe('paid');
  });

  it('classifies social/giulia as organic', () => {
    expect(deriveTrafficType('social', 'ig')).toBe('organic');
    expect(deriveTrafficType('giulia', 'Instagram')).toBe('organic');
  });

  it('classifies ig/Instagram source as organic when medium unknown', () => {
    expect(deriveTrafficType(null, 'ig')).toBe('organic');
    expect(deriveTrafficType(null, 'Instagram')).toBe('organic');
  });

  it('returns unknown when nothing provided', () => {
    expect(deriveTrafficType(null, null)).toBe('unknown');
    expect(deriveTrafficType('', '')).toBe('unknown');
  });

  it('returns unknown for unmapped combinations', () => {
    expect(deriveTrafficType('email', 'newsletter')).toBe('unknown');
  });
});

describe('parseHotmartCsvRow', () => {
  const validRow = {
    'Data da compra': '27-03-2026 02:55',
    Transacao_prod: 'HP1628716836_6721435',
    Status: 'PURCHASE_APPROVED',
    'Nome do Comprador': 'Daiane Rodrigues Pinheiro',
    Email: 'donrane@hotmail.com',
    Celular: '22999313009',
    'Produto comprado': 'Método SAL',
    'Cod do produto': '6721435',
    Comissão: '588.1',
    'UTM Source': 'meta',
    'UTM Medium': 'cpc',
    'UTM Campaign': '120241419256510361',
    'UTM Term': 'AD09 - Vídeo - Como você se apresentaria',
    'UTM Content': '01 - [TODOS] [BRASIL] [ABERTO]_Instagram_Feed',
  };

  it('parses a valid approved sale', () => {
    const result = parseHotmartCsvRow(validRow);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.transactionId).toBe('HP1628716836_6721435');
    expect(result.sale.status).toBe('approved');
    expect(result.sale.rawStatus).toBe('PURCHASE_APPROVED');
    expect(result.sale.buyerEmail).toBe('donrane@hotmail.com');
    expect(result.sale.commissionCents).toBe(58810);
    expect(result.sale.trafficType).toBe('paid');
    expect(result.sale.utmTerm).toBe('AD09 - Vídeo - Como você se apresentaria');
  });

  it('normalizes Brazilian phone to E.164', () => {
    const result = parseHotmartCsvRow(validRow);
    if (!result.ok) throw new Error('parse failed');
    expect(result.sale.buyerPhoneE164).toBe('+5522999313009');
    expect(result.sale.buyerPhoneRaw).toBe('22999313009');
  });

  it('preserves international phone in E.164', () => {
    const row = { ...validRow, Celular: '351910141422' };
    const result = parseHotmartCsvRow(row);
    if (!result.ok) throw new Error('parse failed');
    // 12 digits → has country code → +351910141422
    expect(result.sale.buyerPhoneE164).toBe('+351910141422');
  });

  it('handles teste completo with comma decimal', () => {
    const row = { ...validRow, Status: 'teste completo', Comissão: '23,8' };
    const result = parseHotmartCsvRow(row);
    if (!result.ok) throw new Error('parse failed');
    expect(result.sale.status).toBe('test');
    expect(result.sale.commissionCents).toBe(2380);
  });

  it('classifies organic when medium=social', () => {
    const row = {
      ...validRow,
      'UTM Source': 'ig',
      'UTM Medium': 'social',
      'UTM Campaign': 'organico',
      'UTM Term': 'link_in_bio',
      'UTM Content': '',
    };
    const result = parseHotmartCsvRow(row);
    if (!result.ok) throw new Error('parse failed');
    expect(result.sale.trafficType).toBe('organic');
  });

  it('classifies unknown when no UTM data', () => {
    const row = {
      ...validRow,
      'UTM Source': '',
      'UTM Medium': '',
      'UTM Campaign': '',
      'UTM Term': '',
      'UTM Content': '',
    };
    const result = parseHotmartCsvRow(row);
    if (!result.ok) throw new Error('parse failed');
    expect(result.sale.trafficType).toBe('unknown');
    expect(result.sale.utmSource).toBeNull();
  });

  it('fails on missing transaction id', () => {
    const row = { ...validRow, Transacao_prod: '' };
    const result = parseHotmartCsvRow(row);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('missing_transaction_id');
  });

  it('fails on invalid commission', () => {
    const row = { ...validRow, Comissão: 'abc' };
    const result = parseHotmartCsvRow(row);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('invalid_commission');
  });
});

describe('parseHotmartCsvText', () => {
  it('handles headers with trailing whitespace (Hotmart export quirk)', () => {
    const csv = `Data da compra ,Transacao_prod,Status,Nome do Comprador,Email,Celular,Produto comprado,Cod do produto,Comissão,UTM Source,UTM Medium,UTM Campaign,UTM Term,UTM Content
27-03-2026 02:55,HP1628716836_6721435,PURCHASE_APPROVED,Daiane,a@b.com,11999999999,Método SAL,6721435,588.1,meta,cpc,123,AD01,Feed`;
    const result = parseHotmartCsvText(csv);
    expect(result.sales).toHaveLength(1);
    expect(result.failures).toHaveLength(0);
    expect(result.sales[0]!.transactionId).toBe('HP1628716836_6721435');
  });

  it('detects intra-file duplicate transaction ids', () => {
    const csv = `Data da compra,Transacao_prod,Status,Nome do Comprador,Email,Celular,Produto comprado,Cod do produto,Comissão,UTM Source,UTM Medium,UTM Campaign,UTM Term,UTM Content
27-03-2026 02:55,HP123_6721435,PURCHASE_APPROVED,Daiane,a@b.com,11999999999,Método SAL,6721435,588.1,meta,cpc,123,AD01,Feed
28-03-2026 10:00,HP123_6721435,PURCHASE_APPROVED,Daiane,a@b.com,11999999999,Método SAL,6721435,588.1,meta,cpc,123,AD01,Feed`;
    const result = parseHotmartCsvText(csv);
    expect(result.sales).toHaveLength(2);
    expect(result.duplicateTransactionIds).toEqual(['HP123_6721435']);
  });

  it('handles quoted fields with comma decimal commission', () => {
    const csv = `Data da compra,Transacao_prod,Status,Nome do Comprador,Email,Celular,Produto comprado,Cod do produto,Comissão,UTM Source,UTM Medium,UTM Campaign,UTM Term,UTM Content
28-03-2026 16:22,HP1343118782_6721435,teste completo,Cristiane,c@d.com,91992394020,Método SAL,6721435,"588,1",meta,cpc,123,AD05,Feed`;
    const result = parseHotmartCsvText(csv);
    expect(result.sales).toHaveLength(1);
    expect(result.sales[0]!.commissionCents).toBe(58810);
    expect(result.sales[0]!.status).toBe('test');
  });

  it('returns failures for malformed rows without dropping the good ones', () => {
    const csv = `Data da compra,Transacao_prod,Status,Nome do Comprador,Email,Celular,Produto comprado,Cod do produto,Comissão,UTM Source,UTM Medium,UTM Campaign,UTM Term,UTM Content
27-03-2026 02:55,HP_OK_6721435,PURCHASE_APPROVED,Daiane,a@b.com,11999999999,Método SAL,6721435,588.1,meta,cpc,123,AD01,Feed
,HP_BAD_6721435,PURCHASE_APPROVED,X,x@y.com,1199,Método SAL,6721435,588.1,meta,cpc,123,AD01,Feed`;
    const result = parseHotmartCsvText(csv);
    expect(result.sales).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.reason).toBe('missing_date');
  });
});
