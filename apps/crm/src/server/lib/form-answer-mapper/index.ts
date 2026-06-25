/**
 * Maps a self-hosted form submission to a partial Lead record (ParsedLead).
 *
 * Mirrors respondi-payload-mapper but for OUR forms (substituem o Respondi):
 *   - Input: the form's field definitions + raw answers keyed by field id.
 *   - Each field carries its own `leadMapping` (which lead column it fills) and,
 *     for enum columns, a `leadEnumMap` (EXACT option→enum-literal map).
 *   - Unmapped fields (leadMapping == null) live only in form_responses.dados;
 *     they never reach the lead.
 *
 * Determinism (CLAUDE.md: dado determinístico não se chuta):
 *   - Enum values are translated by EXACT lookup in leadEnumMap — no fuzzy
 *     `includes()` heuristics (unlike the Respondi mapper, which has to guess
 *     because Respondi gives no per-option control). A value missing from the
 *     map yields `null` for that field AND is recorded in `enumLookupMisses`,
 *     so the caller can flag the lead for manual review instead of silently
 *     dropping a known answer.
 *
 * Reuses the ParsedLead contract from respondi-payload-mapper so both intake
 * paths feed the same downstream (dedup + insert). This module is PURE: no DB.
 */

import { normalizeWhatsapp } from '../whatsapp-normalizer/index';
import type {
  AbordagemPreferida,
  IdadeFaixa,
  ParsedLead,
  TempoNoNichoFaixa,
} from '../respondi-payload-mapper/index';

// The mapping targets a form field can declare. Subset/rename parity with
// LEAD_MAPPING_TARGETS in @repo/db (packages/db/src/schema/form-fields.ts) and
// with LeadField in the Respondi mapper.
export type LeadMappingTarget =
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

const ENUM_TARGETS = new Set<LeadMappingTarget>([
  'idadeFaixa',
  'abordagemPreferida',
  'tempoNoNichoFaixa',
]);

// Minimal field shape the mapper needs (a subset of the DB FormField row).
export interface MapperField {
  id: string;
  leadMapping?: LeadMappingTarget | null;
  leadEnumMap?: Record<string, string> | null;
}

export type RawAnswer = string | string[] | number | boolean | null | undefined;
export type FormAnswers = Record<string, RawAnswer>;

export interface FormMapInput {
  fields: MapperField[];
  answers: FormAnswers;
  /** Stable id for lead-level idempotency (ex: 'form:<responseId>'). */
  intakeRespondentId: string;
  /** When the response was submitted (defaults handled by caller). */
  receivedAt: Date;
  /** UTM captured from the public page query string (config.coletarUtm). */
  utm?: {
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmTerm?: string | null;
    utmContent?: string | null;
  } | null;
}

export interface FormMapResult {
  lead: ParsedLead;
  /** Fields whose enum value was not found in leadEnumMap (→ flag review). */
  enumLookupMisses: Array<{ fieldId: string; target: LeadMappingTarget; value: string }>;
}

export function mapFormAnswers(input: FormMapInput): FormMapResult {
  const lead: ParsedLead = {
    intakeRespondentId: input.intakeRespondentId,
    receivedAt: input.receivedAt,
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
    utmSource: input.utm?.utmSource ?? null,
    utmMedium: input.utm?.utmMedium ?? null,
    utmCampaign: input.utm?.utmCampaign ?? null,
    utmTerm: input.utm?.utmTerm ?? null,
    utmContent: input.utm?.utmContent ?? null,
    unmappedQuestionIds: [],
  };

  const enumLookupMisses: FormMapResult['enumLookupMisses'] = [];

  for (const field of input.fields) {
    const target = field.leadMapping;
    if (!target) {
      // Not mapped to a lead column → stays only in form_responses.dados.
      continue;
    }

    const raw = input.answers[field.id];
    const value = answerToString(raw);

    if (ENUM_TARGETS.has(target)) {
      if (value == null) continue;
      const mapped = field.leadEnumMap?.[value] ?? null;
      if (mapped == null) {
        enumLookupMisses.push({ fieldId: field.id, target, value });
        continue; // leave the enum field null; caller flags review
      }
      applyEnum(lead, target, mapped);
      continue;
    }

    applyText(lead, target, value);
  }

  if (lead.instagramHandle) {
    lead.instagramHandle = normalizeInstagramHandle(lead.instagramHandle);
  }

  return { lead, enumLookupMisses };
}

function applyText(lead: ParsedLead, target: LeadMappingTarget, value: string | null): void {
  switch (target) {
    case 'name':
      lead.name = value;
      break;
    case 'nickname':
      lead.nickname = value;
      break;
    case 'email':
      lead.email = value?.toLowerCase().trim() ?? null;
      break;
    case 'whatsappE164': {
      const result = normalizeWhatsapp(value);
      if (result.ok) {
        lead.whatsappE164 = result.e164;
      } else {
        lead.whatsappE164 = null;
        lead.whatsappNormalizationError = result.reason;
      }
      break;
    }
    case 'instagramHandle':
      lead.instagramHandle = value;
      break;
    case 'cidade':
      lead.cidade = value;
      break;
    case 'estado':
      lead.estado = value;
      break;
    case 'profissao':
      lead.profissao = value;
      break;
    case 'tempoNegocio':
      lead.tempoNegocio = value;
      break;
    case 'rendaFaixa':
      lead.rendaFaixa = value;
      break;
    case 'orcamentoFaixa':
      lead.orcamentoFaixa = value;
      break;
    case 'leadSourceSlug':
      // Already a deterministic slug chosen in the builder; pass through.
      lead.leadSourceSlug = value;
      break;
    // enum targets handled in applyEnum
    case 'idadeFaixa':
    case 'abordagemPreferida':
    case 'tempoNoNichoFaixa':
      break;
  }
}

function applyEnum(lead: ParsedLead, target: LeadMappingTarget, mapped: string): void {
  switch (target) {
    case 'idadeFaixa':
      lead.idadeFaixa = mapped as IdadeFaixa;
      break;
    case 'abordagemPreferida':
      lead.abordagemPreferida = mapped as AbordagemPreferida;
      break;
    case 'tempoNoNichoFaixa':
      lead.tempoNoNichoFaixa = mapped as TempoNoNichoFaixa;
      break;
    default:
      break;
  }
}

function answerToString(raw: RawAnswer): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : null;
  if (typeof raw === 'boolean') return raw ? 'sim' : 'nao';
  if (Array.isArray(raw)) {
    const joined = raw
      .filter((s) => typeof s === 'string' && s.length > 0)
      .join(', ')
      .trim();
    return joined || null;
  }
  return null;
}

function normalizeInstagramHandle(raw: string): string {
  let h = raw.trim();
  h = h.replace(/^https?:\/\/(www\.)?(instagram\.com\/)?/i, '');
  h = h.split(/[/?]/)[0] ?? h;
  h = h.replace(/^@/, '');
  return h.toLowerCase();
}
