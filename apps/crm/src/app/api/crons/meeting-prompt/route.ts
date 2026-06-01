/**
 * Cron: meeting-prompt (every 15 minutes via Vercel Cron)
 *
 * Marks meetings as needs_confirmation=true when:
 *   - status = 'agendada'
 *   - scheduled_at + 30 minutes <= now
 *
 * The Kanban picks up needs_confirmation=true and shows a banner on the lead card.
 * Auth: CRON_SECRET header injected by Vercel.
 */

import { and, eq, lte, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const threshold = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago

  const result = await db
    .update(schema.meetings)
    .set({ needsConfirmation: true, updatedAt: new Date() })
    .where(
      and(
        eq(schema.meetings.status, 'agendada'),
        eq(schema.meetings.needsConfirmation, false),
        lte(schema.meetings.scheduledAt, threshold),
        sql`${schema.meetings.deletedAt} IS NULL`,
      ),
    )
    .returning({ id: schema.meetings.id });

  return NextResponse.json({ ok: true, marked: result.length });
}
