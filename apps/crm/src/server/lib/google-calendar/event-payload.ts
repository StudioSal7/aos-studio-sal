/**
 * Builder puro do payload de evento da reunião (POST Calendar v3).
 *
 * A description vaza pro lead (sendUpdates=all envia o convite) — texto
 * neutro, NUNCA URL do CRM. Rastreabilidade fica em extendedProperties.private
 * (invisível pra convidados).
 */

import type { EventPayload } from './types';

export const DEFAULT_MEETING_DURATION_MINUTES = 60;

const TIMEZONE = 'America/Sao_Paulo';

export interface MeetingEventInput {
  meetingId: string;
  leadName: string;
  leadEmail: string | null;
  leadId: string;
  startUtc: Date;
  durationMinutes?: number;
}

export function buildMeetingEventPayload(input: MeetingEventInput): EventPayload {
  const duration = input.durationMinutes ?? DEFAULT_MEETING_DURATION_MINUTES;
  const endUtc = new Date(input.startUtc.getTime() + duration * 60_000);

  const payload: EventPayload = {
    summary: `Reunião SAL — ${input.leadName}`,
    description: 'Reunião agendada pela equipe SAL.',
    // Instante UTC é a fonte; timeZone é como o Google apresenta o horário.
    start: { dateTime: input.startUtc.toISOString(), timeZone: TIMEZONE },
    end: { dateTime: endUtc.toISOString(), timeZone: TIMEZONE },
    extendedProperties: {
      private: {
        crmLeadId: input.leadId,
        crmMeetingId: input.meetingId,
      },
    },
    conferenceData: {
      // requestId determinístico por meeting: repetir o POST não gera Meet novo.
      createRequest: {
        requestId: `crm-${input.meetingId}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  if (input.leadEmail) {
    payload.attendees = [{ email: input.leadEmail }];
  }

  return payload;
}

/** start/end de um PATCH de reagendamento (mesma duração default). */
export function buildEventTimePatch(
  startUtc: Date,
  durationMinutes: number = DEFAULT_MEETING_DURATION_MINUTES,
): { start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string } } {
  const endUtc = new Date(startUtc.getTime() + durationMinutes * 60_000);
  return {
    start: { dateTime: startUtc.toISOString(), timeZone: TIMEZONE },
    end: { dateTime: endUtc.toISOString(), timeZone: TIMEZONE },
  };
}
