'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { fromZonedTime } from 'date-fns-tz';
import { revalidatePath } from 'next/cache';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { requireAuth } from '@/server/auth';
import type { ActionResult } from '@/server/actions/leads';
import {
  buildEventTimePatch,
  buildMeetingEventPayload,
  createEvent,
  deleteEvent,
  getActiveAccountWithToken,
  patchEventTime,
} from '@/server/lib/google-calendar';

/**
 * Resultado da propagação CRM→Google (mão única, best-effort).
 * O CRM é a fonte de verdade: a mutação no banco NUNCA é desfeita por
 * falha na Google — o status existe pra UI avisar com honestidade.
 */
export type GoogleSyncStatus =
  | 'created'
  | 'created_no_invite'
  | 'updated'
  | 'deleted'
  | 'skipped_not_connected'
  | 'failed';

// ---- Schedule a new meeting ----

type ScheduleMeetingInput = {
  leadId: string;
  scheduledAt: string; // ISO string from the form (assumed BRT, stored as UTC)
  link?: string;
  notesPreCall?: string;
};

export async function scheduleMeetingAction(
  input: ScheduleMeetingInput,
): Promise<ActionResult<{ meetingId: string; googleSync: GoogleSyncStatus }>> {
  await requireAuth();

  const [lead] = await db
    .select({
      id: schema.leads.id,
      name: schema.leads.name,
      nickname: schema.leads.nickname,
      email: schema.leads.email,
    })
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

  const googleSync = await createGoogleEventForMeeting({
    meetingId: meeting.id,
    lead,
    scheduledAt,
    manualLink: input.link,
  });

  revalidatePath(`/leads/${input.leadId}`);
  return { ok: true, data: { meetingId: meeting.id, googleSync } };
}

async function createGoogleEventForMeeting(args: {
  meetingId: string;
  lead: { id: string; name: string | null; nickname: string | null; email: string | null };
  scheduledAt: Date;
  manualLink?: string;
}): Promise<GoogleSyncStatus> {
  const active = await getActiveAccountWithToken();
  if (!active.ok) return 'skipped_not_connected';

  try {
    const payload = buildMeetingEventPayload({
      meetingId: args.meetingId,
      leadName: args.lead.nickname ?? args.lead.name ?? 'Lead',
      leadEmail: args.lead.email,
      leadId: args.lead.id,
      startUtc: args.scheduledAt,
    });
    const created = await createEvent(active.accessToken, payload);

    await db
      .update(schema.meetings)
      .set({
        googleEventId: created.eventId,
        googleAccountId: active.account.id,
        // Meet gerado vira o link da reunião quando a Ana não colou um.
        ...(!args.manualLink && created.meetLink ? { link: created.meetLink } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.meetings.id, args.meetingId));

    return args.lead.email ? 'created' : 'created_no_invite';
  } catch {
    return 'failed';
  }
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
): Promise<ActionResult<{ meetingId: string; googleSync: GoogleSyncStatus }>> {
  await requireAuth();

  const newScheduledAt = fromZonedTime(input.newScheduledAt, 'America/Sao_Paulo');
  if (Number.isNaN(newScheduledAt.getTime())) {
    return { ok: false, error: 'invalid_date' };
  }

  const [original] = await db
    .select({
      id: schema.meetings.id,
      status: schema.meetings.status,
      link: schema.meetings.link,
      googleEventId: schema.meetings.googleEventId,
      googleAccountId: schema.meetings.googleAccountId,
    })
    .from(schema.meetings)
    .where(
      and(eq(schema.meetings.id, input.originalMeetingId), isNull(schema.meetings.deletedAt)),
    )
    .limit(1);

  if (!original) return { ok: false, error: 'meeting_not_found' };
  if (original.status !== 'agendada') return { ok: false, error: 'invalid_status' };

  let newMeetingId: string;

  await db.transaction(async (tx) => {
    // Soft-cancel the original — vínculo Google migra pra nova linha
    // (nunca duas meetings apontando pro mesmo evento).
    await tx
      .update(schema.meetings)
      .set({
        status: 'reagendada',
        googleEventId: null,
        googleAccountId: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.meetings.id, input.originalMeetingId));

    // Create the new meeting
    const [newMeeting] = await tx
      .insert(schema.meetings)
      .values({
        leadId: input.leadId,
        scheduledAt: newScheduledAt,
        link: input.link ?? original.link,
        status: 'agendada',
        needsConfirmation: false,
        googleEventId: original.googleEventId,
        googleAccountId: original.googleAccountId,
      })
      .returning({ id: schema.meetings.id });

    if (!newMeeting) throw new Error('Insert failed');
    newMeetingId = newMeeting.id;
  });

  // PATCH no MESMO evento (Google notifica o convidado da mudança).
  let googleSync: GoogleSyncStatus = 'skipped_not_connected';
  if (original.googleEventId) {
    const active = await getActiveAccountWithToken();
    if (active.ok) {
      try {
        await patchEventTime(
          active.accessToken,
          original.googleEventId,
          buildEventTimePatch(newScheduledAt),
        );
        googleSync = 'updated';
      } catch {
        googleSync = 'failed';
      }
    } else {
      // Há evento vinculado mas a conta caiu — o evento NÃO foi atualizado
      // (fica com o horário antigo). 'skipped_not_connected' mentiria dizendo
      // que não havia vínculo.
      googleSync = 'failed';
    }
  }

  revalidatePath(`/leads/${input.leadId}`);
  return { ok: true, data: { meetingId: newMeetingId!, googleSync } };
}

// ---- Cancel a scheduled meeting ----

type CancelMeetingInput = {
  meetingId: string;
  leadId: string;
};

export async function cancelMeetingAction(
  input: CancelMeetingInput,
): Promise<ActionResult<{ googleSync: GoogleSyncStatus }>> {
  await requireAuth();

  const [meeting] = await db
    .select({
      id: schema.meetings.id,
      status: schema.meetings.status,
      googleEventId: schema.meetings.googleEventId,
    })
    .from(schema.meetings)
    .where(and(eq(schema.meetings.id, input.meetingId), isNull(schema.meetings.deletedAt)))
    .limit(1);

  if (!meeting) return { ok: false, error: 'meeting_not_found' };
  if (meeting.status !== 'agendada') return { ok: false, error: 'invalid_status' };

  await db
    .update(schema.meetings)
    .set({ status: 'cancelada', needsConfirmation: false, updatedAt: new Date() })
    .where(eq(schema.meetings.id, meeting.id));

  // DELETE do evento (sendUpdates=all avisa o convidado); 404/410 = já sumiu.
  let googleSync: GoogleSyncStatus = 'skipped_not_connected';
  if (meeting.googleEventId) {
    const active = await getActiveAccountWithToken();
    if (active.ok) {
      try {
        await deleteEvent(active.accessToken, meeting.googleEventId);
        googleSync = 'deleted';
      } catch {
        googleSync = 'failed';
      }
    } else {
      // Há evento vinculado mas a conta caiu — o evento continua vivo na
      // agenda (convite ativo). 'skipped_not_connected' mentiria dizendo
      // que não havia vínculo.
      googleSync = 'failed';
    }
  }

  revalidatePath(`/leads/${input.leadId}`);
  return { ok: true, data: { googleSync } };
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
