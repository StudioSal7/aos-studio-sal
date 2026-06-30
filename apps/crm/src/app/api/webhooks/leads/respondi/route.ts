/**
 * POST /api/webhooks/leads/respondi?token=<WEBHOOK_TOKEN_RESPONDI>
 *
 * Receives a Respondi.app webhook, maps the payload to a lead, deduplicates,
 * and inserts or updates the lead record.
 *
 * Idempotency: if the same respondent_id was already processed successfully,
 * we return 200 immediately without re-inserting.
 *
 * Auth: token via query string (Respondi does not support custom request headers).
 */

import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { mapRespondiPayload } from '@/server/lib/respondi-payload-mapper/index';
import { findDuplicateLead } from '@/server/lib/dedup-matcher/index';
import { RESPONDI_FIELD_MAPPING } from '@/lib/respondi-mapping';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // 1. Token validation
  const token = request.nextUrl.searchParams.get('token');
  if (!token || token !== process.env.WEBHOOK_TOKEN_RESPONDI) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // 3. Map payload (validates structure + transforms fields)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapResult = mapRespondiPayload(body as any, RESPONDI_FIELD_MAPPING);

  if (!mapResult.ok) {
    await db.insert(schema.leadIntakeLog).values({
      source: 'respondi_webhook',
      externalId: extractRespondentId(body),
      payloadRaw: body as Record<string, unknown>,
      payloadParsed: null,
      status: 'failed',
      errorMessage: `map_error:${mapResult.reason}`,
    });
    // Return 200 so Respondi doesn't retry; this is a known filter (e.g. status=in_progress).
    return NextResponse.json({ ok: false, reason: mapResult.reason });
  }

  const { lead } = mapResult;

  // 4. Idempotency check via respondent_id in intake log
  const [existingLog] = await db
    .select({ id: schema.leadIntakeLog.id })
    .from(schema.leadIntakeLog)
    .where(eq(schema.leadIntakeLog.externalId, lead.intakeRespondentId))
    .limit(1);

  if (existingLog) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  // 5. Dedup check
  const dupResult = await findDuplicateLead(
    {
      intakeRespondentId: lead.intakeRespondentId,
      email: lead.email,
      whatsappE164: lead.whatsappE164,
    },
    db as Parameters<typeof findDuplicateLead>[1],
  );

  if (dupResult.match) {
    // Upsert: update the existing lead with any new data from this submission.
    await db
      .update(schema.leads)
      .set({
        nickname: lead.nickname ?? undefined,
        instagramHandle: lead.instagramHandle ?? undefined,
        idadeFaixa: lead.idadeFaixa ?? undefined,
        abordagemPreferida: lead.abordagemPreferida ?? undefined,
        tempoNoNichoFaixa: lead.tempoNoNichoFaixa ?? undefined,
        rendaFaixa: lead.rendaFaixa ?? undefined,
        orcamentoFaixa: lead.orcamentoFaixa ?? undefined,
        profissao: lead.profissao ?? undefined,
        utmSource: lead.utmSource ?? undefined,
        utmMedium: lead.utmMedium ?? undefined,
        utmCampaign: lead.utmCampaign ?? undefined,
        utmTerm: lead.utmTerm ?? undefined,
        utmContent: lead.utmContent ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.leads.id, dupResult.leadId));

    await db.insert(schema.leadIntakeLog).values({
      source: 'respondi_webhook',
      externalId: lead.intakeRespondentId,
      payloadRaw: body as Record<string, unknown>,
      payloadParsed: lead as unknown as Record<string, unknown>,
      leadId: dupResult.leadId,
      status: 'duplicate_upsert',
    });

    return NextResponse.json({ ok: true, duplicate: true, leadId: dupResult.leadId });
  }

  // 6. New lead — find the "application_received" stage
  const [stage] = await db
    .select({ id: schema.leadStages.id })
    .from(schema.leadStages)
    .where(eq(schema.leadStages.slug, 'application_received'))
    .limit(1);

  if (!stage) {
    return NextResponse.json({ error: 'stage_not_seeded' }, { status: 500 });
  }

  // 7. Insert lead
  const [inserted] = await db
    .insert(schema.leads)
    .values({
      intakeRespondentId: lead.intakeRespondentId,
      name: lead.name,
      nickname: lead.nickname,
      email: lead.email,
      whatsappE164: lead.whatsappE164,
      instagramHandle: lead.instagramHandle,
      idadeFaixa: lead.idadeFaixa ?? undefined,
      abordagemPreferida: lead.abordagemPreferida ?? undefined,
      tempoNoNichoFaixa: lead.tempoNoNichoFaixa ?? undefined,
      rendaFaixa: lead.rendaFaixa,
      orcamentoFaixa: lead.orcamentoFaixa,
      profissao: lead.profissao,
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      utmCampaign: lead.utmCampaign,
      utmTerm: lead.utmTerm,
      utmContent: lead.utmContent,
      stageId: stage.id,
      applicationReceivedAt: lead.receivedAt,
      createdAt: lead.receivedAt,
      updatedAt: lead.receivedAt,
    })
    .returning({ id: schema.leads.id });

  if (!inserted) {
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  await db.insert(schema.leadIntakeLog).values({
    source: 'respondi_webhook',
    externalId: lead.intakeRespondentId,
    payloadRaw: body as Record<string, unknown>,
    payloadParsed: lead as unknown as Record<string, unknown>,
    leadId: inserted.id,
    status: 'ok',
  });

  return NextResponse.json({ ok: true, leadId: inserted.id }, { status: 201 });
}

function extractRespondentId(body: unknown): string | undefined {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const b = body as Record<string, unknown>;
    const respondent = b['respondent'];
    if (respondent && typeof respondent === 'object') {
      const id = (respondent as Record<string, unknown>)['respondent_id'];
      if (typeof id === 'string') return id;
    }
  }
  return undefined;
}
