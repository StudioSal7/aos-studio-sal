/**
 * Maps a Respondi.app webhook payload to a partial Lead record.
 *
 * Payload contract (from https://help.respondi.app/article/48-webhooks-payload-de-exemplo):
 *   { form: { form_id, form_name }, respondent: { date, respondent_id, status, utms, raw_answers[] } }
 *
 * Mapping strategy:
 *   - raw_answers[i].question.question_id is the stable key (question_title is editable, do NOT match by it)
 *   - Each question_id maps to a target field in the lead; transformer parses the answer based on field type
 *   - Unknown question_ids are ignored; raw payload is preserved in lead_intake_log for forensics
 *
 * Filter:
 *   - Only processes status='completed' (Respondi may send rascunhos in the future; safest to filter)
 *
 * Returns a ParsedLead (partial Lead fields) ready to upsert via dedup-matcher.
 */

import { normalizeWhatsapp } from '../whatsapp-normalizer/index';

// ---- Payload shape (matches Respondi article 48) ----

export interface RespondiAddress {
  country?: string | null;
  cep?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  number?: string | null;
  addressComp?: string | null;
}

export type RespondiAnswer = string | string[] | RespondiAddress | null;

export interface RespondiRawAnswer {
  question: {
    question_id: string;
    question_title: string;
    question_type: string;
  };
  answer: RespondiAnswer;
}

export interface RespondiPayload {
  form: {
    form_id: string;
    form_name: string;
  };
  respondent: {
    date: string;
    respondent_id: string;
    score?: number;
    status: string;
    respondent_utms?: {
      utm_source?: string | null;
      utm_medium?: string | null;
      utm_campaign?: string | null;
      utm_term?: string | null;
      utm_content?: string | null;
    } | null;
    answers?: Record<string, string> | null;
    raw_answers: RespondiRawAnswer[];
  };
}

// ---- Target field configuration ----

export type LeadField =
  | 'name'
  | 'nickname'
  | 'email'
  | 'whatsappE164'
  | 'instagramHandle'
  | 'cidade'
  | 'estado'
  | 'profissao'
  | 'tempoNegocio'
  | 'rendaFaixa'
  | 'orcamentoFaixa'
  | 'idadeFaixa'
  | 'abordagemPreferida'
  | 'tempoNoNichoFaixa'
  | 'leadSourceSlug';

export type QuestionMapping = Record<string, LeadField>;

// ---- Output ----

export type IdadeFaixa = '19_a_24' | '25_a_34' | '35_a_44' | '45_a_54' | '55_a_64';
export type AbordagemPreferida = 'orientacao_sensivel' | 'equipe_constroi';
export type TempoNoNichoFaixa = 'menos_5' | '5_a_10' | '11_a_15' | 'mais_16';

export interface ParsedLead {
  intakeRespondentId: string;
  receivedAt: Date;
  name: string | null;
  nickname: string | null;
  email: string | null;
  whatsappE164: string | null;
  whatsappNormalizationError: string | null;
  instagramHandle: string | null;
  cidade: string | null;
  estado: string | null;
  profissao: string | null;
  tempoNegocio: string | null;
  rendaFaixa: string | null;
  orcamentoFaixa: string | null;
  idadeFaixa: IdadeFaixa | null;
  abordagemPreferida: AbordagemPreferida | null;
  tempoNoNichoFaixa: TempoNoNichoFaixa | null;
  leadSourceSlug: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  unmappedQuestionIds: string[];
}

export type MapResult =
  | { ok: true; lead: ParsedLead }
  | { ok: false; reason: 'invalid_status' | 'empty_payload'; status?: string };

// ---- Mapper ----

export function mapRespondiPayload(
  payload: RespondiPayload,
  mapping: QuestionMapping,
): MapResult {
  if (payload.respondent.status !== 'completed') {
    return { ok: false, reason: 'invalid_status', status: payload.respondent.status };
  }
  if (!payload.respondent.raw_answers || payload.respondent.raw_answers.length === 0) {
    return { ok: false, reason: 'empty_payload' };
  }

  const lead: ParsedLead = {
    intakeRespondentId: payload.respondent.respondent_id,
    receivedAt: parseDate(payload.respondent.date),
    name: null,
    nickname: null,
    email: null,
    whatsappE164: null,
    whatsappNormalizationError: null,
    instagramHandle: null,
    cidade: null,
    estado: null,
    profissao: null,
    tempoNegocio: null,
    rendaFaixa: null,
    orcamentoFaixa: null,
    idadeFaixa: null,
    abordagemPreferida: null,
    tempoNoNichoFaixa: null,
    leadSourceSlug: null,
    utmSource: payload.respondent.respondent_utms?.utm_source ?? null,
    utmMedium: payload.respondent.respondent_utms?.utm_medium ?? null,
    utmCampaign: payload.respondent.respondent_utms?.utm_campaign ?? null,
    utmTerm: payload.respondent.respondent_utms?.utm_term ?? null,
    utmContent: payload.respondent.respondent_utms?.utm_content ?? null,
    unmappedQuestionIds: [],
  };

  for (const raw of payload.respondent.raw_answers) {
    const target = mapping[raw.question.question_id];
    if (!target) {
      lead.unmappedQuestionIds.push(raw.question.question_id);
      continue;
    }
    applyAnswer(lead, target, raw.answer);
  }

  // Strip @ and URL prefix from instagram if present
  if (lead.instagramHandle) {
    lead.instagramHandle = normalizeInstagramHandle(lead.instagramHandle);
  }

  return { ok: true, lead };
}

function applyAnswer(lead: ParsedLead, field: LeadField, raw: RespondiAnswer): void {
  const stringValue = answerToString(raw);

  switch (field) {
    case 'name':
      lead.name = stringValue;
      break;
    case 'nickname':
      lead.nickname = stringValue;
      break;
    case 'email':
      lead.email = stringValue?.toLowerCase().trim() ?? null;
      break;
    case 'whatsappE164': {
      const result = normalizeWhatsapp(stringValue);
      if (result.ok) {
        lead.whatsappE164 = result.e164;
      } else {
        lead.whatsappE164 = null;
        lead.whatsappNormalizationError = result.reason;
      }
      break;
    }
    case 'instagramHandle':
      lead.instagramHandle = stringValue;
      break;
    case 'cidade':
      // If answer is an address object, prefer its city field; otherwise treat as string
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        lead.cidade = raw.city ?? stringValue;
        lead.estado = raw.state ?? lead.estado;
      } else {
        lead.cidade = stringValue;
      }
      break;
    case 'estado':
      lead.estado = stringValue;
      break;
    case 'profissao':
      lead.profissao = stringValue;
      break;
    case 'tempoNegocio':
      lead.tempoNegocio = stringValue;
      break;
    case 'rendaFaixa':
      lead.rendaFaixa = stringValue;
      break;
    case 'orcamentoFaixa':
      lead.orcamentoFaixa = stringValue;
      break;
    case 'idadeFaixa':
      lead.idadeFaixa = parseIdadeFaixa(stringValue);
      break;
    case 'abordagemPreferida':
      lead.abordagemPreferida = parseAbordagemPreferida(stringValue);
      break;
    case 'tempoNoNichoFaixa':
      lead.tempoNoNichoFaixa = parseTempoNoNichoFaixa(stringValue);
      break;
    case 'leadSourceSlug':
      lead.leadSourceSlug = parseLeadSourceSlug(stringValue);
      break;
  }
}

function answerToString(raw: RespondiAnswer): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (Array.isArray(raw)) {
    const joined = raw.filter((s) => typeof s === 'string' && s.length > 0).join(', ').trim();
    return joined || null;
  }
  // Address object: don't flatten generically; let cidade case handle it
  return null;
}

function parseDate(raw: string): Date {
  // Respondi sends "YYYY-MM-DD HH:MM" with no TZ; we interpret as SP TZ.
  // Storing as a Date object converts to UTC under the hood; Postgres timestamptz handles it.
  // For SP (UTC-3), append "-03:00" to anchor the parse.
  const isoLike = raw.replace(' ', 'T') + '-03:00';
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
}

function parseIdadeFaixa(value: string | null): IdadeFaixa | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('19') && lower.includes('24')) return '19_a_24';
  if (lower.includes('25') && lower.includes('34')) return '25_a_34';
  if (lower.includes('35') && lower.includes('44')) return '35_a_44';
  if (lower.includes('45') && lower.includes('54')) return '45_a_54';
  if (lower.includes('55') && lower.includes('64')) return '55_a_64';
  return null;
}

function parseAbordagemPreferida(value: string | null): AbordagemPreferida | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('orientação') || lower.includes('orientacao') || lower.includes('aplique')) {
    return 'orientacao_sensivel';
  }
  if (lower.includes('equipe') || lower.includes('construa')) {
    return 'equipe_constroi';
  }
  return null;
}

function parseTempoNoNichoFaixa(value: string | null): TempoNoNichoFaixa | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('menos de 5')) return 'menos_5';
  if (lower.includes('5 e 10') || lower.includes('5 a 10')) return '5_a_10';
  if (lower.includes('11 e 15') || lower.includes('11 a 15')) return '11_a_15';
  if (lower.includes('mais de 16') || lower.includes('mais de 15')) return 'mais_16';
  return null;
}

function parseLeadSourceSlug(value: string | null): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('giu salvatore') || lower.includes('giu')) return 'giu_salvatore_indicacao';
  if (lower.includes('reels') || lower.includes('instagram')) return 'instagram_organico';
  if (lower.includes('pessoa me indicou') || lower.includes('indicação') || lower.includes('indicacao')) {
    return 'indicacao_pessoal';
  }
  if (lower.includes('tik tok') || lower.includes('tiktok')) return 'tiktok';
  if (lower.includes('podcast')) return 'podcast';
  return 'outro';
}

function normalizeInstagramHandle(raw: string): string {
  let h = raw.trim();
  // Strip URL prefix
  h = h.replace(/^https?:\/\/(www\.)?(instagram\.com\/)?/i, '');
  // Strip trailing slash and query
  h = h.split(/[/?]/)[0] ?? h;
  // Strip leading @
  h = h.replace(/^@/, '');
  return h.toLowerCase();
}
