import { describe, expect, it } from 'vitest';
import { parseCsvStatement, parseOfxStatement } from './index';

const ACCOUNT_ID = 'acc-1';

const VALID_OFX = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260715120000[-3:BRT]
<TRNAMT>-150.00
<FITID>202607150001
<MEMO>PAGAMENTO FORNECEDOR X
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260716
<TRNAMT>1000.00
<FITID>202607160001
<MEMO>RECEBIMENTO CLIENTE Y
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

describe('parseOfxStatement', () => {
  it('parseia transações válidas com data, valor e fitid', () => {
    const result = parseOfxStatement(VALID_OFX, ACCOUNT_ID);
    expect(result.errors).toHaveLength(0);
    expect(result.transactions).toHaveLength(2);

    const [debit, credit] = result.transactions;
    expect(debit!.amountCents).toBe(-15000);
    expect(debit!.fitid).toBe('202607150001');
    expect(debit!.description).toBe('PAGAMENTO FORNECEDOR X');
    expect(debit!.postedAt.toISOString().slice(0, 10)).toBe('2026-07-15');

    expect(credit!.amountCents).toBe(100000);
    expect(credit!.postedAt.toISOString().slice(0, 10)).toBe('2026-07-16');
  });

  it('gera dedupHash igual pro mesmo fitid+conta, diferente pra conta diferente', () => {
    const a = parseOfxStatement(VALID_OFX, 'acc-1').transactions[0]!;
    const b = parseOfxStatement(VALID_OFX, 'acc-1').transactions[0]!;
    const c = parseOfxStatement(VALID_OFX, 'acc-2').transactions[0]!;
    expect(a.dedupHash).toBe(b.dedupHash);
    expect(a.dedupHash).not.toBe(c.dedupHash);
  });

  it('reporta erro quando não há nenhum <STMTTRN> no arquivo', () => {
    const result = parseOfxStatement('conteúdo qualquer sem transações', ACCOUNT_ID);
    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.reason).toContain('nenhuma transação');
  });

  it('reporta erro por transação com DTPOSTED ausente, sem quebrar as demais', () => {
    const ofx = `
<STMTTRN>
<TRNAMT>-50.00
<FITID>1
<MEMO>sem data
</STMTTRN>
<STMTTRN>
<DTPOSTED>20260101
<TRNAMT>10.00
<FITID>2
<MEMO>válida
</STMTTRN>
`;
    const result = parseOfxStatement(ofx, ACCOUNT_ID);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.fitid).toBe('2');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.reason).toContain('DTPOSTED ausente');
  });

  it('reporta erro por TRNAMT inválido', () => {
    const ofx = `
<STMTTRN>
<DTPOSTED>20260101
<TRNAMT>não-é-um-número
<FITID>1
<MEMO>quebrada
</STMTTRN>
`;
    const result = parseOfxStatement(ofx, ACCOUNT_ID);
    expect(result.transactions).toHaveLength(0);
    expect(result.errors[0]!.reason).toContain('TRNAMT inválido');
  });

  it('usa "(sem descrição)" quando não há MEMO nem NAME', () => {
    const ofx = `
<STMTTRN>
<DTPOSTED>20260101
<TRNAMT>10.00
<FITID>1
</STMTTRN>
`;
    const result = parseOfxStatement(ofx, ACCOUNT_ID);
    expect(result.transactions[0]!.description).toBe('(sem descrição)');
  });
});

describe('parseCsvStatement', () => {
  it('parseia linhas válidas (data ISO, descrição, valor)', () => {
    const csv = ['2026-07-15,Pagamento fornecedor,-150.00', '2026-07-16,Recebimento cliente,1000.00'].join('\n');
    const result = parseCsvStatement(csv, ACCOUNT_ID);
    expect(result.errors).toHaveLength(0);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]!.amountCents).toBe(-15000);
    expect(result.transactions[0]!.fitid).toBeNull();
  });

  it('aceita data no formato brasileiro DD/MM/YYYY', () => {
    const csv = '15/07/2026,Teste,50.00';
    const result = parseCsvStatement(csv, ACCOUNT_ID);
    expect(result.transactions[0]!.postedAt.toISOString().slice(0, 10)).toBe('2026-07-15');
  });

  it('pula silenciosamente uma linha de cabeçalho na primeira linha', () => {
    const csv = ['data,descricao,valor', '2026-07-15,Teste,10.00'].join('\n');
    const result = parseCsvStatement(csv, ACCOUNT_ID);
    expect(result.transactions).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('reporta erro de data inválida no MEIO do arquivo (não é cabeçalho)', () => {
    const csv = ['2026-07-15,Válida,10.00', 'data-quebrada,Teste,20.00'].join('\n');
    const result = parseCsvStatement(csv, ACCOUNT_ID);
    expect(result.transactions).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  it('reporta erro quando faltam colunas', () => {
    const result = parseCsvStatement('2026-07-15,só duas colunas', ACCOUNT_ID);
    expect(result.transactions).toHaveLength(0);
    expect(result.errors[0]!.reason).toContain('3 colunas');
  });

  it('dedupHash sem fitid é determinístico pro mesmo conteúdo', () => {
    const csv = '2026-07-15,Teste,10.00';
    const a = parseCsvStatement(csv, ACCOUNT_ID).transactions[0]!;
    const b = parseCsvStatement(csv, ACCOUNT_ID).transactions[0]!;
    expect(a.dedupHash).toBe(b.dedupHash);
  });
});
