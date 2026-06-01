'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { fromZonedTime } from 'date-fns-tz';
import { revalidatePath } from 'next/cache';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { requireAuth } from '@/server/auth';
import type { ActionResult } from '@/server/actions/leads';

// ---- Schedule a new meeting ----

type ScheduleMeetingInput = {
  leadId: string;
  scheduledAt: string; // ISO string from the form (assumed BRT, stored as UTC)
  link?: string;
  notesPreCall?: string;
};

export async function scheduleMeetingAction(
  input: ScheduleMeetingInput,
): Promise<ActionResult<{ meetingId: string }>> {
  await requireAuth();

  const [lead] = await db
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), isNull(schema.leads.deletedAt)))
    .limit(1);

  if (!lead) return { ok: false, error: 'lead_not_found' };

  // datetime-local input gives "YYYY-MM-DDTHH:mm" without TZ; interpret as SP.
  const scheduledAt = fromZonedTime(input.scheduledAt, 'America/Sao_Paulo');
  if (Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, error: 'invalid_date' };
  }

  const [meeting] = await db
    .insert(schema.meetings)
    .values({
      leadId: input.leadId,
      scheduledAt,
      link: input.link,
      status: 'agendada',
      needsConfirmation: false,
    })
    .returning({ id: schema.meetings.id });

  if (!meeting) return { ok: false, error: 'insert_failed' };

  revalidatePath(`/leads/${input.leadId}`);
  return { ok: true, data: { meetingId: meeting.id } };
}

// ---- Reschedule: cancel old + create new ----

type RescheduleMeetingInput = {
  originalMeetingId: string;
  leadId: string;
  newScheduledAt: string;
  link?: string;
};

export async function rescheduleMeetingAction(
  input: RescheduleMeetingInput,
): Promise<ActionResult<{ meetingId: string }>> {
  await requireAuth();

  const newScheduledAt = fromZonedTime(input.newScheduledAt, 'America/Sao_Paulo');
  if (Number.isNaN(newScheduledAt.getTime())) {
    return { ok: false, error: 'invalid_date' };
  }

  let newMeetingId: string;

  await db.transaction(async (tx) => {
    // Soft-cancel the original
    await tx
      .update(schema.meetings)
      .set({ status: 'reagendada', updatedAt: new Date() })
      .where(eq(schema.meetings.id, input.originalMeetingId));

    // Create the new meeting
    const [newMeeting] = await tx
      .insert(schema.meetings)
      .values({
        leadId: input.leadId,
        scheduledAt: newScheduledAt,
        link: input.link,
        status: 'agendada',
        needsConfirmation: false,
      })
      .returning({ id: schema.meetings.id });

    if (!newMeeting) throw new Error('Insert failed');
    newMeetingId = newMeeting.id;
  });

  revalidatePath(`/leads/${input.leadId}`);
  return { ok: true, data: { meetingId: newMeetingId! } };
}

// ---- Mark meeting outcome ----

type CompleteMeetingInput = {
  meetingId: string;
  leadId: string;
  status: 'realizada' | 'nao_realizada';
  notesPostCall?: string;
};

export async function completeMeetingAction(
  input: CompleteMeetingInput,
): Promise<ActionResult> {
  await requireAuth();

  await db
    .update(schema.meetings)
    .set({
      status: input.status,
      notesPostCall: input.notesPostCall,
      needsConfirmation: false,
      updatedAt: new Date(),
    })
    .where(eq(schema.meetings.id, input.meetingId));

  revalidatePath(`/leads/${input.leadId}`);
  return { ok: true };
}
