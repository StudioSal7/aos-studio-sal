/**
 * Tipos compartilhados do módulo google-calendar.
 * Espelham o subset da API Google Calendar v3 que o CRM usa.
 */

export interface EventDateTime {
  /** ISO com offset — presente em eventos com horário. */
  dateTime?: string;
  /** `yyyy-MM-dd` — presente em eventos de dia inteiro. */
  date?: string;
  timeZone?: string;
}

export interface RawCalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  start?: EventDateTime;
  end?: EventDateTime;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { uri: string }[];
  };
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scope: string;
  email: string;
}

/** Body do POST /calendars/primary/events. */
export interface EventPayload {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: { email: string }[];
  extendedProperties?: { private: Record<string, string> };
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: 'hangoutsMeet' };
    };
  };
}
