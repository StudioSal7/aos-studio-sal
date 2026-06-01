export const OPERATION_TZ = 'America/Sao_Paulo' as const;

export const STAGE_SLUGS = {
  APPLICATION_RECEIVED: 'application_received',
  UNDER_REVIEW: 'under_review',
  QUALIFIED: 'qualified',
  FIRST_CONTACT_SENT: 'first_contact_sent',
  MEETING_SCHEDULED: 'meeting_scheduled',
  MEETING_DONE: 'meeting_done',
  PROPOSAL_SENT: 'proposal_sent',
  CLOSED_VERBALLY: 'closed_verbally',
  CONTRACT_SENT: 'contract_sent',
  PAID: 'paid',
  LOST: 'lost',
} as const;

export type StageSlug = (typeof STAGE_SLUGS)[keyof typeof STAGE_SLUGS];
