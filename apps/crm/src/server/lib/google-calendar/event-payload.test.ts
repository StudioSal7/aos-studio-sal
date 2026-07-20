import { describe, expect, it } from 'vitest';
import { buildEventTimePatch, buildMeetingEventPayload } from './event-payload';

const BASE = {
  meetingId: 'meet-123',
  leadName: 'Bianca',
  leadEmail: 'bianca@example.com' as string | null,
  leadId: 'lead-456',
  startUtc: new Date('2026-07-20T17:00:00.000Z'), // 14:00 SP
};

describe('buildMeetingEventPayload', () => {
  it('monta summary com o nome do lead e attendee com o email', () => {
    const p = buildMeetingEventPayload(BASE);
    expect(p.summary).toBe('Reunião SAL — Bianca');
    expect(p.attendees).toEqual([{ email: 'bianca@example.com' }]);
  });

  it('lead sem email → sem attendees (nenhum convite)', () => {
    const p = buildMeetingEventPayload({ ...BASE, leadEmail: null });
    expect(p.attendees).toBeUndefined();
  });

  it('end = start + 60min por default; timeZone SP nos dois campos', () => {
    const p = buildMeetingEventPayload(BASE);
    expect(p.start).toEqual({
      dateTime: '2026-07-20T17:00:00.000Z',
      timeZone: 'America/Sao_Paulo',
    });
    expect(p.end).toEqual({
      dateTime: '2026-07-20T18:00:00.000Z',
      timeZone: 'America/Sao_Paulo',
    });
  });

  it('duração custom respeitada', () => {
    const p = buildMeetingEventPayload({ ...BASE, durationMinutes: 30 });
    expect(p.end.dateTime).toBe('2026-07-20T17:30:00.000Z');
  });

  it('Meet automático com requestId determinístico por meeting', () => {
    const p = buildMeetingEventPayload(BASE);
    expect(p.conferenceData?.createRequest.requestId).toBe('crm-meet-123');
    expect(p.conferenceData?.createRequest.conferenceSolutionKey.type).toBe('hangoutsMeet');
  });

  it('rastreabilidade em extendedProperties.private; description sem URL de CRM', () => {
    const p = buildMeetingEventPayload(BASE);
    expect(p.extendedProperties?.private).toEqual({
      crmLeadId: 'lead-456',
      crmMeetingId: 'meet-123',
    });
    // description vaza pro convidado — nunca link interno
    expect(p.description).not.toMatch(/https?:\/\//);
    expect(p.description).not.toContain('lead-456');
  });
});

describe('buildEventTimePatch', () => {
  it('patch com mesma duração default e timeZone SP', () => {
    const patch = buildEventTimePatch(new Date('2026-07-21T13:00:00.000Z'));
    expect(patch.start.dateTime).toBe('2026-07-21T13:00:00.000Z');
    expect(patch.end.dateTime).toBe('2026-07-21T14:00:00.000Z');
    expect(patch.start.timeZone).toBe('America/Sao_Paulo');
    expect(patch.end.timeZone).toBe('America/Sao_Paulo');
  });
});
