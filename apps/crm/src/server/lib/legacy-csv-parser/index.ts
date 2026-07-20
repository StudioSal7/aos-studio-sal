/**
 * Parses a legacy Respondi/Google-Sheets CSV export into structured lead records.
 *
 * Column mapping is configurable via CsvColumnMap so the parser works with
 * different column headers without code changes.
 *
 * Status normalization maps the legacy free-text status values to CRM stage slugs
 * and flags leads that need manual review (closer never updated them properly).
 *
 * Never throws — every row returns either { ok: true, lead } or { ok: false, reason }.
 */

import { normalizeWhatsapp } from '../whatsapp-normalizer/index';

// ---- Column configuration ----

export interface CsvColumnMap {
  nome: string;
  apelido?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  status?: string;
  observacoes?: string;
  data?: string;
  fonte?: string;
  idade?: string;
  renda?: string;
  orcamento?: string;
  tempoNicho?: string;
  abordagem?: string;
  pontuacao?: string;
  respondentId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export const DEFAULT_COLUMN_MAP: CsvColumnMap = {
  nome: 'Nome',
  apelido: 'Apelido',
  email: 'Email',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  status: 'Status',
  observacoes: 'Observações',
  data: 'Data',
};

// ---- Stage mapping ----

export type StageMapping = {
  stageSlug: string;
  lossReasonSlug: string | null;
  needsManualReview: boolean;
  manualReviewReason: string | null;
  createMeeting: boolean;
  meetingStatus: 'agendada' | 'reagendada' | null;
};

const STATUS_MAP: Record<string, StageMapping> = {
  '': {
    stageSlug: 'application_received',
    lossReasonSlug: null,
    needsManualReview: false,
    manualReviewReason: null,
    createMeeting: false,
    meetingStatus: null,
  },
  pendente: {
    stageSlug: 'application_received',
    lossReasonSlug: null,
    needsManualReview: false,
    manualReviewReason: null,
    createMeeting: false,
    meetingStatus: null,
  },
  analisar: {
    stageSlug: 'under_review',
    lossReasonSlug: null,
    needsManualReview: false,
    manualReviewReason: null,
    createMeeting: false,
    meetingStatus: null,
  },
  aprovado: {
    stageSlug: 'qualified',
    lossReasonSlug: null,
    needsManualReview: false,
    manualReviewReason: null,
    createMeeting: false,
    meetingStatus: null,
  },
  'whatsapp enviado': {
    stageSlug: 'first_contact_sent',
    lossReasonSlug: null,
    needsManualReview: false,
    manualReviewReason: null,
    createMeeting: false,
    meetingStatus: null,
  },
  'reunião agendada': {
    stageSlug: 'meeting_scheduled',
    lossReasonSlug: null,
    needsManualReview: false,
    manualReviewReason: null,
    createMeeting: true,
    meetingStatus: 'agendada',
  },
  'reagendar encontro': {
    stageSlug: 'meeting_scheduled',
    lossReasonSlug: null,
    needsManualReview: false,
    manualReviewReason: null,
    createMeeting: true,
    meetingStatus: 'reagendada',
  },
  'proposta enviada': {
    stageSlug: 'proposal_sent',
    lossReasonSlug: null,
    needsManualReview: false,
    manualReviewReason: null,
    createMeeting: false,
    meetingStatus: null,
  },
  'finalizado.': {
    stageSlug: 'paid',
    lossReasonSlug: null,
    needsManualReview: false,
    manualReviewReason: null,
    createMeeting: false,
    meetingStatus: null,
  },
  recusada: {
    stageSlug: 'lost',
    lossReasonSlug: 'qualificacao_reprovada',
    needsManualReview: false,
    manualReviewReason: null,
    createMeeting: false,
    meetingStatus: null,
  },
  'não retornou.': {
    stageSlug: 'lost',
    lossReasonSlug: 'lead_silenciou',
    needsManualReview: false,
    manualReviewReason: null,
    createMeeting: false,
    meetingStatus: null,
  },
  fake: {
    stageSlug: 'lost',
    lossReasonSlug: 'fake_spam',
    needsManualReview: false,
    manualReviewReason: null,
    createMeeting: false,
    meetingStatus: null,
  },
  'aguardar produto': {
    stageSlug: 'under_review',
    lossReasonSlug: null,
    needsManualReview: true,
    manualReviewReason: 'legado: closer não atualizou status',
    createMeeting: false,
    meetingStatus: null,
  },
  'aguardar mentoria': {
    stageSlug: 'under_review',
    lossReasonSlug: null,
    needsManualReview: true,
    manualReviewReason: 'legado: closer não atualizou status',
    createMeeting: false,
    meetingStatus: null,
  },
  'contato salvo': {
    stageSlug: 'under_review',
    lossReasonSlug: null,
    needsManualReview: true,
    manualReviewReason: 'legado: closer não atualizou status',
    createMeeting: false,
    meetingStatus: null,
  },
};

// ---- Output ----

export type IdadeFaixa = '19_a_24' | '25_a_34' | '35_a_44' | '45_a_54' | '55_a_64';
export type TempoNoNichoFaixa = 'menos_5' | '5_a_10' | '11_a_15' | 'mais_16';
export type AbordagemPreferida = 'orientacao_sensivel' | 'equipe_constroi';

export interface ParsedLegacyLead {
  name: string;
  nickname: string | null;
  email: string | null;
  whatsappE164: string | null;
  whatsappNormalizationError: string | null;
  instagramHandle: string | null;
  notes: string | null;
  stageSlug: string;
  lossReasonSlug: string | null;
  needsManualReview: boolean;
  manualReviewReason: string | null;
  createMeeting: boolean;
  meetingStatus: 'agendada' | 'reagendada' | null;
  receivedAt: Date;
  rawStatus: string;
  unmappedStatus: boolean;
  leadSourceSlug: string | null;
  leadSourceOther: string | null;
  idadeFaixa: IdadeFaixa | null;
  tempoNoNichoFaixa: TempoNoNichoFaixa | null;
  abordagemPreferida: AbordagemPreferida | null;
  rendaFaixa: string | null;
  orcamentoFaixa: string | null;
  pontuacao: number | null;
  intakeRespondentId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
}

export type CsvParseResult =
  | { ok: true; lead: ParsedLegacyLead }
  | { ok: false; reason: string; row: Record<string, string> };

// ---- Parser ----

export function parseLegacyCsvRow(
  row: Record<string, string>,
  columnMap: CsvColumnMap = DEFAULT_COLUMN_MAP,
): CsvParseResult {
  const get = (key: keyof CsvColumnMap): string => {
    const col = columnMap[key];
    if (col === undefined) return '';
    return (row[col] ?? '').trim();
  };

  const name = get('nome');
  if (!name) {
    return { ok: false, reason: 'missing_name', row };
  }

  const rawEmail = get('email');
  const email = rawEmail ? rawEmail.toLowerCase() : null;

  const rawWhatsapp = get('whatsapp');
  let whatsappE164: string | null = null;
  let whatsappNormalizationError: string | null = null;

  if (rawWhatsapp) {
    const result = normalizeWhatsapp(rawWhatsapp);
    if (result.ok) {
      whatsappE164 = result.e164;
    } else {
      whatsappNormalizationError = result.reason;
    }
  }

  if (!email && !whatsappE164) {
    return { ok: false, reason: 'no_dedup_key', row };
  }

  const rawInstagram = get('instagram');
  const instagramHandle = rawInstagram ? normalizeInstagramHandle(rawInstagram) : null;

  const rawStatus = get('status').toLowerCase();
  const stageInfo = STATUS_MAP[rawStatus];
  const unmappedStatus = !stageInfo;

  const resolved = stageInfo ?? {
    stageSlug: 'application_received',
    lossReasonSlug: null,
    needsManualReview: true,
    manualReviewReason: `legado: status desconhecido "${get('status')}"`,
    createMeeting: false,
    meetingStatus: null,
  };

  // Heurística: linhas exportadas após a coluna "Pontuação" ter sido removida
  // do Respondi ficam deslocadas em +1. Quando isso acontece, "Pontuação" contém
  // um timestamp ISO e "Data" contém o que era originalmente o ID.
  const rawPontuacao = get('pontuacao');
  const rawDataField = get('data');
  const pontuacaoLooksLikeDate = /^\d{4}-\d{2}-\d{2}/.test(rawPontuacao);

  const rawDate = pontuacaoLooksLikeDate ? rawPontuacao : rawDataField;
  const rawRespondentId = pontuacaoLooksLikeDate ? rawDataField : get('respondentId');
  const pontuacaoForParse = pontuacaoLooksLikeDate ? '' : rawPontuacao;

  const receivedAt = rawDate ? parseDate(rawDate) : new Date();

  const sourceParsed = parseLeadSource(get('fonte'));

  return {
    ok: true,
    lead: {
      name,
      nickname: get('apelido') || null,
      email,
      whatsappE164,
      whatsappNormalizationError,
      instagramHandle,
      notes: get('observacoes') || null,
      stageSlug: resolved.stageSlug,
      lossReasonSlug: resolved.lossReasonSlug,
      needsManualReview: resolved.needsManualReview,
      manualReviewReason: resolved.manualReviewReason,
      createMeeting: resolved.createMeeting,
      meetingStatus: resolved.meetingStatus,
      receivedAt,
      rawStatus: get('status'),
      unmappedStatus,
      leadSourceSlug: sourceParsed.slug,
      leadSourceOther: sourceParsed.other,
      idadeFaixa: parseIdadeFaixa(get('idade')),
      tempoNoNichoFaixa: parseTempoNoNicho(get('tempoNicho')),
      abordagemPreferida: parseAbordagem(get('abordagem')),
      rendaFaixa: get('renda') || null,
      orcamentoFaixa: get('orcamento') || null,
      pontuacao: parsePontuacao(pontuacaoForParse),
      intakeRespondentId: rawRespondentId || null,
      utmSource: get('utmSource') || null,
      utmMedium: get('utmMedium') || null,
      utmCampaign: get('utmCampaign') || null,
      utmTerm: get('utmTerm') || null,
      utmContent: get('utmContent') || null,
    },
  };
}

// ---- CSV file reader ----

export interface ParseFileResult {
  leads: ParsedLegacyLead[];
  failures: Array<{ row: Record<string, string>; reason: string }>;
  duplicateEmailGroups: string[];
  duplicateWhatsappGroups: string[];
}

export function parseLegacyCsvText(
  text: string,
  columnMap: CsvColumnMap = DEFAULT_COLUMN_MAP,
): ParseFileResult {
  const records = parseCsvRecords(text);
  if (records.length < 2) {
    return { leads: [], failures: [], duplicateEmailGroups: [], duplicateWhatsappGroups: [] };
  }

  const headers = records[0]!;
  const leads: ParsedLegacyLead[] = [];
  const failures: Array<{ row: Record<string, string>; reason: string }> = [];

  for (let i = 1; i < records.length; i++) {
    const values = records[i]!;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = values[j] ?? '';
    }

    const result = parseLegacyCsvRow(row, columnMap);
    if (result.ok) {
      leads.push(result.lead);
    } else {
      failures.push({ row, reason: result.reason });
    }
  }

  // Detect intra-file duplicates (same email or same whatsapp appearing more than once).
  const emailCounts = new Map<string, number>();
  const whatsappCounts = new Map<string, number>();

  for (const lead of leads) {
    if (lead.email) emailCounts.set(lead.email, (emailCounts.get(lead.email) ?? 0) + 1);
    if (lead.whatsappE164)
      whatsappCounts.set(lead.whatsappE164, (whatsappCounts.get(lead.whatsappE164) ?? 0) + 1);
  }

  const duplicateEmailGroups = [...emailCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([e]) => e);
  const duplicateWhatsappGroups = [...whatsappCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([w]) => w);

  return { leads, failures, duplicateEmailGroups, duplicateWhatsappGroups };
}

// ---- Helpers ----

// Parses an entire CSV text into records, respecting quoted fields that may span newlines.
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

function parseDate(raw: string): Date {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function normalizeInstagramHandle(raw: string): string {
  let h = raw.trim();
  h = h.replace(/^https?:\/\/(www\.)?(instagram\.com\/)?/i, '');
  h = h.split(/[/?]/)[0] ?? h;
  h = h.replace(/^@/, '');
  return h.toLowerCase();
}

export function parseIdadeFaixa(raw: string): IdadeFaixa | null {
  const s = raw.toLowerCase();
  if (!s) return null;
  if (s.includes('19') && s.includes('24')) return '19_a_24';
  if (s.includes('25') && s.includes('34')) return '25_a_34';
  if (s.includes('35') && s.includes('44')) return '35_a_44';
  if (s.includes('45') && s.includes('54')) return '45_a_54';
  if (s.includes('55') && s.includes('64')) return '55_a_64';
  return null;
}

export function parseTempoNoNicho(raw: string): TempoNoNichoFaixa | null {
  const s = raw.toLowerCase();
  if (!s) return null;
  if (s.includes('menos de 5')) return 'menos_5';
  if (s.includes('5 e 10')) return '5_a_10';
  if (s.includes('11 e 15')) return '11_a_15';
  if (s.includes('mais de 16')) return 'mais_16';
  return null;
}

export function parseAbordagem(raw: string): AbordagemPreferida | null {
  const s = raw.toLowerCase();
  if (!s) return null;
  if (s.includes('sensível') || s.includes('eu mesma aplique')) return 'orientacao_sensivel';
  if (s.includes('equipe que construa') || s.includes('investir mais')) return 'equipe_constroi';
  return null;
}

export function parseLeadSource(raw: string): { slug: string | null; other: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { slug: null, other: null };
  const s = trimmed.toLowerCase();

  if (s.includes('giu salvatore') || s.includes('através da giu')) {
    return { slug: 'giu_salvatore_indicacao', other: null };
  }
  if (s.includes('reels') || s.includes('postagem no instagram')) {
    return { slug: 'instagram_organico', other: null };
  }
  if (s.includes('me indicou') || s.includes('uma pessoa') || s.includes('indicação')) {
    return { slug: 'indicacao_pessoal', other: null };
  }
  if (s.includes('podcast')) {
    return { slug: 'podcast', other: null };
  }
  if (s.includes('tiktok')) {
    return { slug: 'tiktok', other: null };
  }
  // Handle ou URL = indicação pessoal com o handle preservado em "other"
  if (s.startsWith('@') || s.startsWith('http')) {
    return { slug: 'indicacao_pessoal', other: trimmed };
  }
  return { slug: 'outro', other: trimmed };
}

export function parsePontuacao(raw: string): number | null {
  if (!raw) return null;
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}
