/**
 * POST /api/forms/submit
 *
 * Public submission endpoint for self-hosted forms (substitui o webhook
 * Respondi). Middleware exempts /api/*, so no session is required — this is a
 * legitimate public form submission. Guard-railed server-side: the form must
 * exist and be 'ativo', and required fields are validated again here.
 *
 * Flow (mirrors the Respondi webhook pipeline via the shared lead-intake module):
 *   1. Load form + fields; reject if not 'ativo'.
 *   2. Server-side validate answers.
 *   3. Insert form_responses (raw audit).
 *   4. mapFormAnswers → ParsedLead (deterministic enum lookup).
 *   5. ingestLead → insert/dedup-upsert lead + lead_intake_log (formulario_web).
 *   6. Write leadId back onto the form_response.
 */

import { asc, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { ingestLead } from '@/server/lib/lead-intake/index';
import {
  mapFormAnswers,
  type MapperField,
  type FormAnswers,
} from '@/server/lib/form-answer-mapper/index';
import { validateField } from '@/components/forms/validation';
import type { FormFieldView } from '@/components/forms/types';

export const runtime = 'nodejs';

interface SubmitBody {
  formId?: string;
  answers?: FormAnswers;
  startedAt?: string;
  metadata?: schema.FormResponseMetadata;
}

export async function POST(request: NextRequest) {
  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { formId, answers, startedAt, metadata } = body;
  if (!formId || typeof formId !== 'string') {
    return NextResponse.json({ error: 'missing_form_id' }, { status: 400 });
  }
  const safeAnswers: FormAnswers = answers && typeof answers === 'object' ? answers : {};

  // 1. Load form + fields; must be 'ativo'.
  const [form] = await db
    .select({
      id: schema.forms.id,
      status: schema.forms.status,
      config: schema.forms.config,
    })
    .from(schema.forms)
    .where(eq(schema.forms.id, formId))
    .limit(1);

  if (!form) {
    return NextResponse.json({ error: 'form_not_found' }, { status: 404 });
  }
  if (form.status !== 'ativo') {
    return NextResponse.json({ error: 'form_not_active' }, { status: 403 });
  }

  const fields = await db
    .select()
    .from(schema.formFields)
    .where(eq(schema.formFields.formId, form.id))
    .orderBy(asc(schema.formFields.ordem));

  // 2. Server-side validation (reuse the runtime validator).
  for (const field of fields) {
    const view = toFieldView(field);
    const err = validateField(view, safeAnswers[field.id]);
    if (err) {
      return NextResponse.json(
        { error: 'validation_failed', fieldId: field.id, message: err },
        { status: 422 },
      );
    }
  }

  // 3. Insert raw response.
  const receivedAt = new Date();
  const startedAtDate = parseDate(startedAt);
  const tempoSeg =
    startedAtDate != null
      ? Math.max(0, Math.round((receivedAt.getTime() - startedAtDate.getTime()) / 1000))
      : null;

  const [response] = await db
    .insert(schema.formResponses)
    .values({
      formId: form.id,
      dados: safeAnswers as Record<string, unknown>,
      metadata: metadata ?? null,
      iniciadoEm: startedAtDate ?? undefined,
      concluidoEm: receivedAt,
      tempoPreenchimentoSeg: tempoSeg ?? undefined,
      parcial: false,
    })
    .returning({ id: schema.formResponses.id });

  if (!response) {
    return NextResponse.json({ error: 'response_insert_failed' }, { status: 500 });
  }

  // 4. Map answers → ParsedLead (deterministic).
  const mapperFields: MapperField[] = fields.map((f) => ({
    id: f.id,
    leadMapping: f.leadMapping ?? null,
    leadEnumMap: f.leadEnumMap ?? null,
  }));

  const { lead, enumLookupMisses } = mapFormAnswers({
    fields: mapperFields,
    answers: safeAnswers,
    intakeRespondentId: `form:${response.id}`,
    receivedAt,
    utm: metadata
      ? {
          utmSource: metadata.utmSource ?? null,
          utmMedium: metadata.utmMedium ?? null,
          utmCampaign: metadata.utmCampaign ?? null,
          utmTerm: metadata.utmTerm ?? null,
          utmContent: metadata.utmContent ?? null,
        }
      : null,
  });

  // Default lead source = 'formulario' when the form didn't map one explicitly.
  if (!lead.leadSourceSlug) {
    lead.leadSourceSlug = 'formulario';
  }

  const flagReview =
    enumLookupMisses.length > 0
      ? `form_enum_unmatched:${enumLookupMisses.map((m) => m.target).join(',')}`
      : null;

  // 5. Ingest (dedup → insert/upsert → intake log).
  const result = await ingestLead(
    lead,
    {
      source: 'formulario_web',
      externalId: `form:${response.id}`,
      payloadRaw: { formId: form.id, answers: safeAnswers, metadata: metadata ?? null },
      payloadParsed: lead as unknown as Record<string, unknown>,
      flagReview,
    },
    db,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 500 });
  }

  // 6. Link the lead back onto the response.
  await db
    .update(schema.formResponses)
    .set({ leadId: result.leadId })
    .where(eq(schema.formResponses.id, response.id));

  return NextResponse.json({
    ok: true,
    leadId: result.leadId,
    deduped: result.deduped,
    redirecionarUrl: form.config?.redirecionarUrl ?? null,
  });
}

function toFieldView(f: typeof schema.formFields.$inferSelect): FormFieldView {
  return {
    id: f.id,
    ordem: f.ordem,
    tipo: f.tipo,
    titulo: f.titulo,
    subtitulo: f.subtitulo,
    placeholder: f.placeholder,
    obrigatorio: f.obrigatorio,
    config: f.config,
    leadMapping: f.leadMapping,
    leadEnumMap: f.leadEnumMap,
  };
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
