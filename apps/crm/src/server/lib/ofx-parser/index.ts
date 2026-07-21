/**
 * Parser de extrato bancário — OFX 1.x (SGML, o formato que a maioria dos
 * bancos brasileiros exporta) como padrão, CSV genérico como fallback.
 * Puro: nunca lança, devolve `ok`/`reason` por linha (espelha
 * `hotmart-csv-parser`/`legacy-csv-parser`).
 *
 * ⚠️ Sem um arquivo real do André pra calibrar (pendência registrada no
 * PLANO_ATIVO.md) — testado contra fixtures genéricas do formato OFX 1.x
 * documentado publicamente. Ajustar aqui quando um extrato real chegar.
 */

import { createHash } from 'node:crypto';

export interface StatementTransaction {
  fitid: string | null;
  postedAt: Date;
  amountCents: number; // com sinal: + entrada, − saída
  description: string;
  dedupHash: string;
}

export type StatementParseLineResult =
  | { ok: true; transaction: StatementTransaction }
  | { ok: false; reason: string; raw: string };

export interface StatementParseResult {
  transactions: StatementTransaction[];
  errors: { reason: string; raw: string }[];
}

function dedupHashFor(accountId: string, fitid: string | null, postedAt: Date, amountCents: number, description: string): string {
  const key = fitid
    ? `${accountId}|fitid|${fitid}`
    : `${accountId}|noid|${postedAt.toISOString()}|${amountCents}|${description}`;
  return createHash('sha256').update(key).digest('hex');
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([^<\r\n]*)`, 'i'));
  return match ? match[1]!.trim() : null;
}

// DTPOSTED vem como YYYYMMDD[HHMMSS][.xxx][:TZ]. Usa meio-dia UTC (não meia-
// noite) pra não haver risco de o dia mudar ao converter fuso, mesmo padrão
// já usado em liquidateFinancialEntryAction.
function parseOfxDate(raw: string): Date | null {
  const digits = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!digits) return null;
  const [, year, month, day] = digits;
  return new Date(`${year}-${month}-${day}T12:00:00Z`);
}

function parseAmountToCents(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function parseOfxStatement(content: string, accountId: string): StatementParseResult {
  const transactions: StatementTransaction[] = [];
  const errors: { reason: string; raw: string }[] = [];

  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  if (blocks.length === 0) {
    return { transactions, errors: [{ reason: 'nenhuma transação (<STMTTRN>) encontrada no arquivo', raw: content.slice(0, 200) }] };
  }

  for (const block of blocks) {
    const dtposted = extractTag(block, 'DTPOSTED');
    const trnamt = extractTag(block, 'TRNAMT');
    const fitid = extractTag(block, 'FITID');
    const memo = extractTag(block, 'MEMO') ?? extractTag(block, 'NAME');

    if (!dtposted) {
      errors.push({ reason: 'DTPOSTED ausente', raw: block });
      continue;
    }
    const postedAt = parseOfxDate(dtposted);
    if (!postedAt) {
      errors.push({ reason: `DTPOSTED inválido: ${dtposted}`, raw: block });
      continue;
    }

    if (!trnamt) {
      errors.push({ reason: 'TRNAMT ausente', raw: block });
      continue;
    }
    const amountCents = parseAmountToCents(trnamt);
    if (amountCents === null) {
      errors.push({ reason: `TRNAMT inválido: ${trnamt}`, raw: block });
      continue;
    }

    const description = memo ?? '(sem descrição)';
    transactions.push({
      fitid,
      postedAt,
      amountCents,
      description,
      dedupHash: dedupHashFor(accountId, fitid, postedAt, amountCents, description),
    });
  }

  return { transactions, errors };
}

// Fallback CSV genérico — 3 colunas posicionais: data (YYYY-MM-DD ou
// DD/MM/YYYY), descrição, valor (sinal indica entrada/saída). Header opcional
// (linha detectada e pulada se a 1ª coluna não parsear como data).
export function parseCsvStatement(content: string, accountId: string): StatementParseResult {
  const transactions: StatementTransaction[] = [];
  const errors: { reason: string; raw: string }[] = [];

  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  for (const line of lines) {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) {
      errors.push({ reason: 'esperava 3 colunas (data,descrição,valor)', raw: line });
      continue;
    }
    const [dateRaw, description, amountRaw] = cols;

    const postedAt = parseCsvDate(dateRaw!);
    if (!postedAt) {
      // provável linha de cabeçalho — pula silenciosamente na primeira linha,
      // reporta erro se acontecer no meio do arquivo.
      if (line === lines[0]) continue;
      errors.push({ reason: `data inválida: ${dateRaw}`, raw: line });
      continue;
    }

    const amountCents = parseAmountToCents(amountRaw!);
    if (amountCents === null) {
      errors.push({ reason: `valor inválido: ${amountRaw}`, raw: line });
      continue;
    }

    transactions.push({
      fitid: null,
      postedAt,
      amountCents,
      description: description || '(sem descrição)',
      dedupHash: dedupHashFor(accountId, null, postedAt, amountCents, description || ''),
    });
  }

  return { transactions, errors };
}

function parseCsvDate(raw: string): Date | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00Z`);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00Z`);
  return null;
}
