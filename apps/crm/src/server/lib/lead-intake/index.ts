/**
 * Shared lead-intake: turns a ParsedLead into a lead row (insert or dedup-upsert)
 * and writes the funnel audit to lead_intake_log.
 *
 * This is the SAME pipeline the Respondi webhook runs inline
 * (apps/crm/src/app/api/webhooks/leads/respondi/route.ts), extracted so the new
 * forms feature can reuse it without touching the working webhook (CLAUDE.md:
 * fatiar, não quebrar código que funciona). The webhook stays as-is for now; a
 * later optional slice can retrofit it onto this module.
 *
 * What it adds over the inline webhook code:
 *   - Resolves ParsedLead.leadSourceSlug → leads.leadSourceId (the known gap the
 *     webhook never closed). Unknown slug → leadSourceId stays null.
 *   - Optional `flagReview`: set needsManualReview + reason (used when the form
 *     mapper reports enum-lookup misses).
 *
 * Dedup, stage lookup ('application_received'), the upsert field subset, and the
 * intake-log writes mirror the webhook 1:1.
 */

import { eq } from 'drizzle-orm';
import * as schema from '@repo/db/schema';
import type { Db } from '@repo/db/client';
import { findDuplicateLead } from '../dedup-matcher/index';
import type { ParsedLead } from '../respondi-payload-mapper/index';

export type IntakeSource = (typeof schema.intakeSourceEnum.enumValues)[number];

export interface IngestContext {
  source: IntakeSource;
  /** External id for the intake log (ex: 'form:<responseId>'). */
  externalId: string;
  payloadRaw: Record<string, unknown>;
  payloadParsed: Record<string, unknown>;
  /** When set, the lead is flagged for manual review with this reason. */
  flagReview?: string | null;
}

export type IngestResult =
  | {
      ok: true;
      leadId: string;
      deduped: boolean;
      matchedOn: Array<'respondent_id' | 'email' | 'whatsapp'>;
    }
  | { ok: false; reason: 'stage_not_seeded' | 'insert_failed' };

export async function ingestLead(
  lead: ParsedLead,
  ctx: IngestContext,
  db: Db,
): Promise<IngestResult> {
  // 1. Dedup (email OR whatsapp OR respondent_id; excludes soft-deleted).
  const dup = await findDuplicateLead(
    {
      intakeRespondentId: lead.intakeRespondentId,
      email: lead.email,
      whatsappE164: lead.whatsappE164,
    },
    db as Parameters<typeof findDuplicateLead>[1],
  );

  if (dup.match) {
    // Upsert: fill any new data on the existing lead (same subset as webhook).
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
        cidade: lead.cidade ?? undefined,
        estado: lead.estado ?? undefined,
        utmSource: lead.utmSource ?? undefined,
        utmMedium: lead.utmMedium ?? undefined,
        utmCampaign: lead.utmCampaign ?? undefined,
        utmTerm: lead.utmTerm ?? undefined,
        utmContent: lead.utmContent ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.leads.id, dup.leadId));

    await db.insert(schema.leadIntakeLog).values({
      source: ctx.source,
      externalId: ctx.externalId,
      payloadRaw: ctx.payloadRaw,
      payloadParsed: ctx.payloadParsed,
      leadId: dup.leadId,
      status: 'duplicate_upsert',
    });

    return { ok: true, leadId: dup.leadId, deduped: true, matchedOn: dup.matchedOn };
  }

  // 2. New lead — resolve the entry stage.
  const [stage] = await db
    .select({ id: schema.leadStages.id })
    .from(schema.leadStages)
    .where(eq(schema.leadStages.slug, 'application_received'))
    .limit(1);

  if (!stage) {
    await db.insert(schema.leadIntakeLog).values({
      source: ctx.source,
      externalId: ctx.externalId,
      payloadRaw: ctx.payloadRaw,
      payloadParsed: ctx.payloadParsed,
      status: 'failed',
      errorMessage: 'stage_not_seeded',
    });
    return { ok: false, reason: 'stage_not_seeded' };
  }

  // 3. Resolve lead source slug → id (the gap the webhook never closed).
  const leadSourceId = await resolveLeadSourceId(lead.leadSourceSlug, db);

  // 4. Insert.
  const [inserted] = await db
    .insert(schema.leads)
    .values({
      intakeRespondentId: lead.intakeRespondentId,
      name: lead.name,
      nickname: lead.nickname,
      email: lead.email,
      whatsappE164: lead.whatsappE164,
      instagramHandle: lead.instagramHandle,
      cidade: lead.cidade,
      estado: lead.estado,
      leadSourceId: leadSourceId ?? undefined,
      idadeFaixa: lead.idadeFaixa ?? undefined,
      abordagemPreferida: lead.abordagemPreferida ?? undefined,
      tempoNoNichoFaixa: lead.tempoNoNichoFaixa ?? undefined,
      rendaFaixa: lead.rendaFaixa,
      orcamentoFaixa: lead.orcamentoFaixa,
      profissao: lead.profissao,
      tempoNegocio: lead.tempoNegocio,
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      utmCampaign: lead.utmCampaign,
      utmTerm: lead.utmTerm,
      utmContent: lead.utmContent,
      stageId: stage.id,
      needsManualReview: ctx.flagReview ? true : undefined,
      manualReviewReason: ctx.flagReview ?? undefined,
      createdAt: lead.receivedAt,
      updatedAt: lead.receivedAt,
    })
    .returning({ id: schema.leads.id });

  if (!inserted) {
    await db.insert(schema.leadIntakeLog).values({
      source: ctx.source,
      externalId: ctx.externalId,
      payloadRaw: ctx.payloadRaw,
      payloadParsed: ctx.payloadParsed,
      status: 'failed',
      errorMessage: 'insert_failed',
    });
    return { ok: false, reason: 'insert_failed' };
  }

  await db.insert(schema.leadIntakeLog).values({
    source: ctx.source,
    externalId: ctx.externalId,
    payloadRaw: ctx.payloadRaw,
    payloadParsed: ctx.payloadParsed,
    leadId: inserted.id,
    status: 'ok',
  });

  return { ok: true, leadId: inserted.id, deduped: false, matchedOn: [] };
}

async function resolveLeadSourceId(
  slug: string | null,
  db: Db,
): Promise<string | null> {
  if (!slug) return null;
  const [source] = await db
    .select({ id: schema.leadSources.id })
    .from(schema.leadSources)
    .where(eq(schema.leadSources.slug, slug))
    .limit(1);
  return source?.id ?? null;
}
