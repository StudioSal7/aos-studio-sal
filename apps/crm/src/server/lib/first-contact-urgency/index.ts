/**
 * Deriva o sinal de "primeiro contato pendente" para o card do Kanban.
 *
 * Módulo puro (sem DB) — calculado em tempo de render, server-side. Combina dois
 * eixos: tempo (idade desde a aplicação) define a urgência; estágio (ação da SDR)
 * define se o sinal aparece. Some quando o lead sai dos estágios pré-contato.
 *
 * Leads sem applicationReceivedAt (legados/backlog) nunca acendem o sinal.
 */

/** Estágios anteriores ao primeiro contato real (`first_contact_sent`, posição 4). */
export const PRE_CONTACT_STAGE_SLUGS = [
  'application_received',
  'under_review',
  'qualified',
] as const;

/** Janela de SLA do primeiro contato, em horas. */
const SLA_HOURS = 24;

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

export type FirstContactSignal = { urgency: 'new' | 'overdue'; ageDays: number } | null;

export function computeFirstContactSignal(params: {
  stageSlug: string;
  applicationReceivedAt: Date | null;
  now: Date;
}): FirstContactSignal {
  const { stageSlug, applicationReceivedAt, now } = params;

  if (applicationReceivedAt === null) return null;
  if (!(PRE_CONTACT_STAGE_SLUGS as readonly string[]).includes(stageSlug)) return null;

  const ageMs = Math.max(0, now.getTime() - applicationReceivedAt.getTime());
  const ageDays = Math.floor(ageMs / MS_PER_DAY);
  const urgency = ageMs >= SLA_HOURS * MS_PER_HOUR ? 'overdue' : 'new';

  return { urgency, ageDays };
}
