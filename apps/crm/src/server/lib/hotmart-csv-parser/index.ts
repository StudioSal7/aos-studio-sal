/**
 * Parses a Hotmart sales CSV (exported via Hotmart producer panel) into
 * structured sale records.
 *
 * Handles the data quirks observed in the SAL CSV:
 *   - Decimal separator: "588.1" or "588,1" or "23,8"
 *   - Date format: "DD-MM-YYYY HH:MM" interpreted as São Paulo time
 *   - Status: PURCHASE_APPROVED / "teste completo" / etc.
 *   - Phone: raw digits, may be BR or international (e.g. "351..." Portugal)
 *
 * Never throws — every row returns either { ok: true, sale } or { ok: false, reason }.
 */

import { fromZonedTime } from 'date-fns-tz';
import { normalizeWhatsapp } from '../whatsapp-normalizer/index';

// ---- Column configuration ----

export interface HotmartColumnMap {
  data: string;
  transacao: string;
  status: string;
  nome: string;
  email: string;
  celular: string;
  produto: string;
  codProduto: string;
  comissao: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
}

export const DEFAULT_HOTMART_COLUMN_MAP: HotmartColumnMap = {
  data: 'Data da compra',
  transacao: 'Transacao_prod',
  status: 'Status',
  nome: 'Nome do Comprador',
  email: 'Email',
  celular: 'Celular',
  produto: 'Produto comprado',
  codProduto: 'Cod do produto',
  comissao: 'Comissão',
  utmSource: 'UTM Source',
  utmMedium: 'UTM Medium',
  utmCampaign: 'UTM Campaign',
  utmTerm: 'UTM Term',
  utmContent: 'UTM Content',
};

// ---- Output ----

export type NormalizedStatus = 'approved' | 'test' | 'refunded' | 'cancelled' | 'other';
export type TrafficType = 'paid' | 'organic' | 'unknown';

export interface ParsedSale {
  transactionId: string;
  purchasedAt: Date; // UTC
  rawStatus: string;
  status: NormalizedStatus;
  buyerName: string;
  buyerEmail: string;
  buyerPhoneRaw: string | null;
  buyerPhoneE164: string | null;
  productName: string;
  productCode: string;
  commissionCents: number;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  trafficType: TrafficType;
  rawRow: Record<string, string>;
}

export type CsvParseResult =
  | { ok: true; sale: ParsedSale }
  | { ok: false; reason: string; row: Record<string, string> };

export interface ParseFileResult {
  sales: ParsedSale[];
  failures: Array<{ row: Record<string, string>; reason: string }>;
  duplicateTransactionIds: string[];
}

// ---- Row parser ----

export function parseHotmartCsvRow(
  row: Record<string, string>,
  columnMap: HotmartColumnMap = DEFAULT_HOTMART_COLUMN_MAP,
): CsvParseResult {
  const get = (key: keyof HotmartColumnMap): string => {
    const col = columnMap[key];
    return (row[col] ?? '').trim();
  };

  const transactionId = get('transacao');
  if (!transactionId) return { ok: false, reason: 'missing_transaction_id', row };

  const rawDate = get('data');
  if (!rawDate) return { ok: false, reason: 'missing_date', row };
  let purchasedAt: Date;
  try {
    purchasedAt = parseHotmartDate(rawDate);
  } catch (err) {
    return { ok: false, reason: `invalid_date: ${(err as Error).message}`, row };
  }

  const rawStatus = get('status');
  if (!rawStatus) return { ok: false, reason: 'missing_status', row };

  const buyerName = get('nome');
  if (!buyerName) return { ok: false, reason: 'missing_buyer_name', row };

  const rawEmail = get('email');
  if (!rawEmail) return { ok: false, reason: 'missing_email', row };
  const buyerEmail = rawEmail.toLowerCase();

  const productName = get('produto');
  if (!productName) return { ok: false, reason: 'missing_product_name', row };

  const productCode = get('codProduto');
  if (!productCode) return { ok: false, reason: 'missing_product_code', row };

  let commissionCents: number;
  try {
    commissionCents = normalizeCommission(get('comissao'));
  } catch (err) {
    return { ok: false, reason: `invalid_commission: ${(err as Error).message}`, row };
  }

  const rawPhone = get('celular');
  let buyerPhoneE164: string | null = null;
  if (rawPhone) {
    const result = normalizeWhatsapp(rawPhone);
    if (result.ok) buyerPhoneE164 = result.e164;
  }

  const utmSource = get('utmSource') || null;
  const utmMedium = get('utmMedium') || null;
  const utmCampaign = get('utmCampaign') || null;
  const utmTerm = get('utmTerm') || null;
  const utmContent = get('utmContent') || null;

  return {
    ok: true,
    sale: {
      transactionId,
      purchasedAt,
      rawStatus,
      status: normalizeStatus(rawStatus),
      buyerName,
      buyerEmail,
      buyerPhoneRaw: rawPhone || null,
      buyerPhoneE164,
      productName,
      productCode,
      commissionCents,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      trafficType: deriveTrafficType(utmMedium, utmSource),
      rawRow: row,
    },
  };
}

// ---- File parser ----

export function parseHotmartCsvText(
  text: string,
  columnMap: HotmartColumnMap = DEFAULT_HOTMART_COLUMN_MAP,
): ParseFileResult {
  const records = parseCsvRecords(text);
  if (records.length < 2) {
    return { sales: [], failures: [], duplicateTransactionIds: [] };
  }

  // Trim header names — Hotmart export has trailing spaces in some columns
  // (e.g. "Data da compra ").
  const headers = records[0]!.map((h) => h.trim());
  const sales: ParsedSale[] = [];
  const failures: Array<{ row: Record<string, string>; reason: string }> = [];

  for (let i = 1; i < records.length; i++) {
    const values = records[i]!;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = values[j] ?? '';
    }

    const result = parseHotmartCsvRow(row, columnMap);
    if (result.ok) sales.push(result.sale);
    else failures.push({ row, reason: result.reason });
  }

  const txCounts = new Map<string, number>();
  for (const sale of sales) {
    txCounts.set(sale.transactionId, (txCounts.get(sale.transactionId) ?? 0) + 1);
  }
  const duplicateTransactionIds = [...txCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([id]) => id);

  return { sales, failures, duplicateTransactionIds };
}

// ---- Normalizers (exported for tests) ----

export function normalizeCommission(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('empty');

  // Brazilian Hotmart can emit "588.1", "588,1", or with thousands like "1.234,56".
  // Heuristic: if both separators present, dot is thousands and comma is decimal (pt-BR).
  // Otherwise the only separator present is the decimal.
  let normalized: string;
  if (trimmed.includes(',') && trimmed.includes('.')) {
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  } else if (trimmed.includes(',')) {
    normalized = trimmed.replace(',', '.');
  } else {
    normalized = trimmed;
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) throw new Error(`invalid_number: ${raw}`);
  return Math.round(n * 100);
}

export function normalizeStatus(raw: string): NormalizedStatus {
  const s = raw.toLowerCase().trim();
  if (!s) return 'other';
  if (s.includes('purchase_approved') || s === 'approved' || s === 'aprovada') return 'approved';
  if (s.includes('teste') || s === 'test') return 'test';
  if (s.includes('refund') || s.includes('reembolso') || s.includes('estorn')) return 'refunded';
  if (s.includes('cancel') || s.includes('cancelad')) return 'cancelled';
  return 'other';
}

export function parseHotmartDate(raw: string): Date {
  const match = raw.trim().match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`invalid_date_format: ${raw}`);
  const [, day, month, year, hour, minute] = match;
  // Build an ISO string and tell date-fns-tz to interpret it as São Paulo time;
  // it returns the equivalent UTC instant.
  const iso = `${year}-${month}-${day}T${hour}:${minute}:00`;
  return fromZonedTime(iso, 'America/Sao_Paulo');
}

export function deriveTrafficType(
  medium: string | null,
  source: string | null,
): TrafficType {
  const m = (medium ?? '').toLowerCase().trim();
  const s = (source ?? '').toLowerCase().trim();
  if (!m && !s) return 'unknown';
  if (m === 'cpc' || m === 'paid' || m === 'ppc') return 'paid';
  if (m === 'social' || m === 'giulia' || s === 'ig' || s === 'instagram') return 'organic';
  return 'unknown';
}

// ---- CSV record parser (RFC 4180-ish, handles quoted newlines) ----

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      currentRecord.push(currentField);
      currentField = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      currentRecord.push(currentField);
      if (currentRecord.some((f) => f !== '') || currentRecord.length > 1) {
        records.push(currentRecord);
      }
      currentRecord = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }
  if (currentField !== '' || currentRecord.length > 0) {
    currentRecord.push(currentField);
    if (currentRecord.some((f) => f !== '')) {
      records.push(currentRecord);
    }
  }
  return records;
}
