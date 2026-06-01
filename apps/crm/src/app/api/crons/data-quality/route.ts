/**
 * Cron: data-quality (Monday at 08:00 SP = 11:00 UTC)
 *
 * Detects leads that need attention and marks them with requires_attention=true:
 *   - Leads in 'open' stages with no updatedAt activity in the last 14 days
 *   - Leads with needsManualReview=true older than 7 days (not yet actioned)
 *
 * The "Saúde dos dados" view reads requires_attention=true to surface these.
 * Auth: CRON_SECRET header injected by Vercel.
 */

import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

export const runtime = 'nodejs';

const IDLE_DAYS = 14;
const REVIEW_OVERDUE_DAYS = 7;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const idleThreshold = new Date(now.getTime() - IDLE_DAYS * 24 * 60 * 60 * 1000);
  const reviewThreshold = new Date(now.getTime() - REVIEW_OVERDUE_DAYS * 24 * 60 * 60 * 1000);

  // Mark idle open-stage leads
  const idleResult = await db
    .update(schema.leads)
    .set({
      requiresAttention: true,
      requiresAttentionReason: `Sem atividade há mais de ${IDLE_DAYS} dias`,
      updatedAt: now,
    })
    .where(
      and(
        isNull(schema.leads.deletedAt),
        eq(schema.leads.requiresAttention, false),
        lte(schema.leads.updatedAt, idleThreshold),
        sql`EXISTS (
          SELECT 1 FROM lead_stages
          WHERE lead_stages.id = ${schema.leads.stageId}
            AND lead_stages.kind = 'open'
        )`,
      ),
    )
    .returning({ id: schema.leads.id });

  // Mark overdue manual-review leads
  const reviewResult = await db
    .update(schema.leads)
    .set({
      requiresAttention: true,
      requiresAttentionReason: `Aguardando revisão manual há mais de ${REVIEW_OVERDUE_DAYS} dias`,
      updatedAt: now,
    })
    .where(
      and(
        isNull(schema.leads.deletedAt),
        eq(schema.leads.needsManualReview, true),
        eq(schema.leads.requiresAttention, false),
        lte(schema.leads.createdAt, reviewThreshold),
      ),
    )
    .returning({ id: schema.leads.id });

  const total = idleResult.length + reviewResult.length;
  console.log(
    `[data-quality] ${now.toISOString()} — flagged ${total} leads (${idleResult.length} idle, ${reviewResult.length} review overdue)`,
  );

  return NextResponse.json({
    ok: true,
    flagged: total,
    idle: idleResult.length,
    reviewOverdue: reviewResult.length,
  });
}
