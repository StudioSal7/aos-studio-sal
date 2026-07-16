/**
 * POST /api/public/bio-lead
 *
 * Endpoint público do "Direcionador" (link-na-bio inteligente do site da Giulia).
 * Recebe o lead qualificado pelo quiz e grava na tabela `leads` do CRM usando a
 * conexão server-side (service role / DATABASE_URL). O anon key do site NUNCA toca
 * a tabela leads — tudo passa por aqui, onde validamos.
 *
 * Anti-spam (obrigatório antes de ir pro ar):
 *   - Honeypot: campo oculto `empresa`. Se vier preenchido, é bot → 200 fake, sem gravar.
 *   - Rate-limit por IP (janela fixa no Postgres).
 *   - Origin allowlist + x-bio-token são CAMADAS EXTRAS (token vai no bundle do client;
 *     Origin se forja fora do browser) — a defesa real é honeypot + rate-limit.
 *
 * Dedup: se já existe lead com mesmo email/WhatsApp, ENRIQUECE o existente
 * (append da qualificação no `notes` + seta produtoInteresseId se vazio) — nunca
 * duplica nem dropa as respostas.
 *
 * Stage de entrada: slug vem de BIO_LEAD_STAGE_SLUG (default `bio_quiz_novo`),
 * pra não poluir o funil principal. Fonte do lead: slug `bio-quiz` (seedado).
 */

import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { findDuplicateLead } from '@/server/lib/dedup-matcher/index';
import { normalizeWhatsapp } from '@/server/lib/whatsapp-normalizer/index';
import { checkRateLimit } from '@/server/lib/rate-limit/index';

export const runtime = 'nodejs';

const DEFAULT_STAGE_SLUG = 'bio_quiz_novo';
const RATE_LIMIT = 8; // submits por IP por janela
const RATE_WINDOW_SECONDS = 600; // 10 minutos

interface BioLeadPayload {
  nome?: string;
  whatsapp?: string;
  email?: string;
  empresa?: string; // honeypot
  respostas?: Record<string, string>;
  produtoRecomendado?: string;
  resumo?: string;
  intencao?: 'quiz' | 'agendar';
  leadSourceSlug?: string;
  utm?: Partial<
    Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content', string | null>
  >;
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

function allowedOrigins(): string[] {
  return (process.env.BIO_LEAD_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigins();
  const allowOrigin = origin && allowed.includes(origin) ? origin : (allowed[0] ?? '*');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-bio-token',
    Vary: 'Origin',
  };
}

function json(data: unknown, status: number, origin: string | null) {
  return NextResponse.json(data, { status, headers: corsHeaders(origin) });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function originAllowed(request: NextRequest): boolean {
  const allowed = allowedOrigins();
  if (allowed.length === 0) return true; // sem allowlist configurada → não bloqueia

  const origin = request.headers.get('origin');
  if (origin && allowed.includes(origin)) return true;

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (allowed.includes(refOrigin)) return true;
    } catch {
      // referer inválido → ignora
    }
  }
  return false;
}

function buildNotes(payload: BioLeadPayload, now: Date): string {
  const lines = [
    `── Direcionador (bio-quiz) · ${now.toISOString().slice(0, 10)} ──`,
    `Produto recomendado: ${payload.produtoRecomendado ?? '—'}`,
  ];
  if (payload.intencao === 'agendar') {
    lines.push('⚠️ Pediu pra agendar uma conversa.');
  }
  if (payload.resumo) {
    lines.push('', payload.resumo);
  }
  return lines.join('\n');
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');

  // 1. Origin allowlist (camada extra)
  if (!originAllowed(request)) {
    return json({ error: 'forbidden_origin' }, 403, origin);
  }

  // 2. Token compartilhado (camada extra) — só checa se configurado
  const expectedToken = process.env.BIO_LEAD_TOKEN;
  if (expectedToken && request.headers.get('x-bio-token') !== expectedToken) {
    return json({ error: 'unauthorized' }, 401, origin);
  }

  // 3. Parse
  let payload: BioLeadPayload;
  try {
    payload = (await request.json()) as BioLeadPayload;
  } catch {
    return json({ error: 'invalid_json' }, 400, origin);
  }

  // 4. Honeypot — bot tende a preencher `empresa`. 200 fake, sem gravar.
  if (payload.empresa && payload.empresa.trim().length > 0) {
    return json({ ok: true }, 200, origin);
  }

  // 5. Rate-limit por IP
  const rate = await checkRateLimit(db, {
    key: getClientIp(request),
    limit: RATE_LIMIT,
    windowSeconds: RATE_WINDOW_SECONDS,
  });
  if (!rate.allowed) {
    return json({ error: 'rate_limited' }, 429, origin);
  }

  // 6. Validação mínima + normalização
  const nome = payload.nome?.trim();
  const email = payload.email?.trim().toLowerCase();
  const wppResult = normalizeWhatsapp(payload.whatsapp);

  if (!nome || !email || !wppResult.ok) {
    return json({ error: 'invalid_payload' }, 400, origin);
  }
  const whatsappE164 = wppResult.e164;

  const now = new Date();
  const utm = payload.utm ?? {};
  const faturamento = payload.respostas?.faturamento;
  const rendaFaixa =
    faturamento && faturamento !== 'prefiro_nao' ? faturamento : undefined;
  const isAgendar = payload.intencao === 'agendar';

  // 7. Resolve fonte (por slug) e produto recomendado (por slug), best-effort
  const sourceSlug = payload.leadSourceSlug ?? 'bio-quiz';
  const [source] = await db
    .select({ id: schema.leadSources.id })
    .from(schema.leadSources)
    .where(eq(schema.leadSources.slug, sourceSlug))
    .limit(1);

  let produtoInteresseId: string | undefined;
  if (payload.produtoRecomendado) {
    const [produto] = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.slug, payload.produtoRecomendado))
      .limit(1);
    produtoInteresseId = produto?.id;
  }

  const notesBlock = buildNotes(payload, now);

  // 8. Dedup — enriquece o lead existente, nunca duplica/dropa
  const dup = await findDuplicateLead(
    { email, whatsappE164 },
    db as Parameters<typeof findDuplicateLead>[1],
  );

  if (dup.match) {
    const [existing] = await db
      .select({
        notes: schema.leads.notes,
        produtoInteresseId: schema.leads.produtoInteresseId,
      })
      .from(schema.leads)
      .where(eq(schema.leads.id, dup.leadId))
      .limit(1);

    const mergedNotes = existing?.notes
      ? `${existing.notes}\n\n${notesBlock}`
      : notesBlock;

    await db
      .update(schema.leads)
      .set({
        notes: mergedNotes,
        // só preenche o produto se ainda estiver vazio (não sobrescreve)
        produtoInteresseId: existing?.produtoInteresseId ?? produtoInteresseId,
        rendaFaixa,
        // NÃO sobrescreve a fonte de um lead existente — preserva a atribuição
        // original (ex.: lead que veio do Respondi). O toque do bio-quiz fica no notes.
        utmSource: utm.utm_source ?? undefined,
        utmMedium: utm.utm_medium ?? undefined,
        utmCampaign: utm.utm_campaign ?? undefined,
        utmTerm: utm.utm_term ?? undefined,
        utmContent: utm.utm_content ?? undefined,
        ...(isAgendar
          ? {
              requiresAttention: true,
              requiresAttentionReason: 'Pediu agendamento via Direcionador',
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(schema.leads.id, dup.leadId));

    return json({ ok: true, duplicate: true, leadId: dup.leadId }, 200, origin);
  }

  // 9. Novo lead — resolve o stage de entrada por slug (env, default frio)
  const stageSlug = process.env.BIO_LEAD_STAGE_SLUG ?? DEFAULT_STAGE_SLUG;
  const [stage] = await db
    .select({ id: schema.leadStages.id })
    .from(schema.leadStages)
    .where(eq(schema.leadStages.slug, stageSlug))
    .limit(1);

  if (!stage) {
    return json({ error: 'stage_not_seeded' }, 500, origin);
  }

  const [inserted] = await db
    .insert(schema.leads)
    .values({
      name: nome,
      email,
      whatsappE164,
      leadSourceId: source?.id,
      leadSourceOther: source ? undefined : sourceSlug,
      rendaFaixa,
      produtoInteresseId,
      utmSource: utm.utm_source ?? undefined,
      utmMedium: utm.utm_medium ?? undefined,
      utmCampaign: utm.utm_campaign ?? undefined,
      utmTerm: utm.utm_term ?? undefined,
      utmContent: utm.utm_content ?? undefined,
      requiresAttention: isAgendar,
      requiresAttentionReason: isAgendar
        ? 'Pediu agendamento via Direcionador'
        : undefined,
      notes: notesBlock,
      stageId: stage.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: schema.leads.id });

  if (!inserted) {
    return json({ error: 'insert_failed' }, 500, origin);
  }

  return json({ ok: true, leadId: inserted.id }, 201, origin);
}
