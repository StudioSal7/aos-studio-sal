/**
 * Deep module puro do endpoint público POST /api/public/bio-lead: extração de
 * IP confiável, cap de tamanho do payload, allowlist de fonte, e o patch de
 * enrich que nunca sobrescreve dado não-vazio de um lead existente. Sem DB,
 * sem I/O — testável isoladamente.
 */

export const FIELD_LIMITS = {
  nome: 200,
  email: 254,
  rendaFaixa: 100,
  resumo: 4000,
  utm: 256,
  produtoRecomendado: 100,
} as const;

/** Únicas fontes legítimas pra este endpoint — qualquer outro slug enviado
 * pelo cliente é ignorado (nunca repassado livre pro banco/leadSourceOther). */
export const ALLOWED_LEAD_SOURCE_SLUGS = ['bio-quiz'] as const;
export const DEFAULT_LEAD_SOURCE_SLUG = 'bio-quiz';

export interface HeaderReader {
  get(name: string): string | null;
}

/**
 * IP confiável no Vercel: `x-real-ip` é injetado pela plataforma e não pode
 * ser forjado pelo cliente. NUNCA usar o primeiro valor de `x-forwarded-for`
 * — é exatamente o campo que um atacante controla (o proxy anexa o IP real
 * à direita). Se `x-real-ip` faltar, usa o ÚLTIMO hop do XFF (o mais recente,
 * anexado pelo proxy mais próximo), nunca o primeiro.
 */
export function getTrustedClientIp(headers: HeaderReader): string {
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const hops = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const lastHop = hops[hops.length - 1];
    if (lastHop) return lastHop;
  }

  return 'unknown';
}

export interface CapCheckPayload {
  nome?: string;
  email?: string;
  resumo?: string;
  produtoRecomendado?: string;
  respostas?: Record<string, string>;
  utm?: Partial<
    Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content', string | null>
  >;
}

export interface PayloadCapViolation {
  field: string;
  limit: number;
}

/** Primeira violação de tamanho encontrada, ou null se tudo dentro do limite. */
export function findPayloadCapViolation(payload: CapCheckPayload): PayloadCapViolation | null {
  if (payload.nome && payload.nome.length > FIELD_LIMITS.nome) {
    return { field: 'nome', limit: FIELD_LIMITS.nome };
  }
  if (payload.email && payload.email.length > FIELD_LIMITS.email) {
    return { field: 'email', limit: FIELD_LIMITS.email };
  }
  if (payload.resumo && payload.resumo.length > FIELD_LIMITS.resumo) {
    return { field: 'resumo', limit: FIELD_LIMITS.resumo };
  }
  if (
    payload.produtoRecomendado &&
    payload.produtoRecomendado.length > FIELD_LIMITS.produtoRecomendado
  ) {
    return { field: 'produtoRecomendado', limit: FIELD_LIMITS.produtoRecomendado };
  }

  const faturamento = payload.respostas?.faturamento;
  if (faturamento && faturamento.length > FIELD_LIMITS.rendaFaixa) {
    return { field: 'respostas.faturamento', limit: FIELD_LIMITS.rendaFaixa };
  }

  for (const [key, value] of Object.entries(payload.utm ?? {})) {
    if (value && value.length > FIELD_LIMITS.utm) {
      return { field: `utm.${key}`, limit: FIELD_LIMITS.utm };
    }
  }

  return null;
}

/** Só aceita slug da allowlist; qualquer outro valor (inclusive não seedado
 * ou inventado) cai no default — nunca passa livre pro banco. */
export function resolveAllowedSourceSlug(requested: string | undefined): string {
  if (requested && (ALLOWED_LEAD_SOURCE_SLUGS as readonly string[]).includes(requested)) {
    return requested;
  }
  return DEFAULT_LEAD_SOURCE_SLUG;
}

export interface ExistingLeadEnrichable {
  notes: string | null;
  produtoInteresseId: string | null;
  rendaFaixa: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
}

export interface IncomingEnrichFields {
  produtoInteresseId?: string;
  rendaFaixa?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export type EnrichPatch = Partial<
  Pick<
    ExistingLeadEnrichable,
    | 'produtoInteresseId'
    | 'rendaFaixa'
    | 'utmSource'
    | 'utmMedium'
    | 'utmCampaign'
    | 'utmTerm'
    | 'utmContent'
  >
>;

const ENRICHABLE_FIELDS = [
  'produtoInteresseId',
  'rendaFaixa',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmTerm',
  'utmContent',
] as const;

/**
 * Patch de enrich pra um lead JÁ EXISTENTE: só PREENCHE campo vazio, nunca
 * sobrescreve valor não-vazio — um chamador público que só sabe o
 * email/whatsapp de outra pessoa não pode corromper a qualificação/atribuição
 * dela. `requiresAttention` propositalmente NÃO faz parte deste patch: um
 * chamador público não pode empurrar o lead de terceiro pra fila de atenção
 * só alegando "quero agendar" — essa intenção fica registrada no notes (que
 * é sempre um append, nunca sobrescreve).
 */
export function buildEnrichPatch(
  existing: ExistingLeadEnrichable,
  incoming: IncomingEnrichFields,
): EnrichPatch {
  const patch: EnrichPatch = {};
  for (const field of ENRICHABLE_FIELDS) {
    const incomingValue = incoming[field];
    if (!existing[field] && incomingValue) {
      patch[field] = incomingValue;
    }
  }
  return patch;
}
