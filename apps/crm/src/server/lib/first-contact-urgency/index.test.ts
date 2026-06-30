import { describe, expect, it } from 'vitest';
import { computeFirstContactSignal, PRE_CONTACT_STAGE_SLUGS } from './index';

const NOW = new Date('2026-06-30T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

describe('computeFirstContactSignal', () => {
  it('retorna null quando applicationReceivedAt é null (legado)', () => {
    expect(
      computeFirstContactSignal({
        stageSlug: 'application_received',
        applicationReceivedAt: null,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('retorna null quando o estágio não é pré-contato', () => {
    expect(
      computeFirstContactSignal({
        stageSlug: 'first_contact_sent',
        applicationReceivedAt: hoursAgo(1),
        now: NOW,
      }),
    ).toBeNull();
  });

  it('retorna "new" com ageDays 0 quando < 24h em estágio pré-contato', () => {
    expect(
      computeFirstContactSignal({
        stageSlug: 'application_received',
        applicationReceivedAt: hoursAgo(5),
        now: NOW,
      }),
    ).toEqual({ urgency: 'new', ageDays: 0 });
  });

  it('retorna "overdue" quando exatamente 24h (limite do SLA)', () => {
    expect(
      computeFirstContactSignal({
        stageSlug: 'under_review',
        applicationReceivedAt: hoursAgo(24),
        now: NOW,
      }),
    ).toEqual({ urgency: 'overdue', ageDays: 1 });
  });

  it('retorna "overdue" com ageDays correto para 3 dias em "qualified"', () => {
    expect(
      computeFirstContactSignal({
        stageSlug: 'qualified',
        applicationReceivedAt: hoursAgo(72),
        now: NOW,
      }),
    ).toEqual({ urgency: 'overdue', ageDays: 3 });
  });

  it('faz clamp de idade negativa (relógio/fuso) em "new" ageDays 0', () => {
    expect(
      computeFirstContactSignal({
        stageSlug: 'application_received',
        applicationReceivedAt: hoursAgo(-2),
        now: NOW,
      }),
    ).toEqual({ urgency: 'new', ageDays: 0 });
  });

  it('expõe os três slugs pré-contato', () => {
    expect(PRE_CONTACT_STAGE_SLUGS).toEqual([
      'application_received',
      'under_review',
      'qualified',
    ]);
  });
});
