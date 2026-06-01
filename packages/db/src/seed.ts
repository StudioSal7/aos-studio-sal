/**
 * Seeds the catalogs the CRM needs to boot:
 * - 11 lead_stages with immutable slugs
 * - 11 lead_loss_reasons (4 legacy + 7 modern)
 * - 6 lead_sources (5 from legacy CSV + "outro")
 *
 * Idempotent: re-runs are safe (uses ON CONFLICT DO NOTHING on slug).
 *
 * Run with: pnpm db:seed
 */

import { sql } from 'drizzle-orm';
import { db } from './client';
import { leadLossReasons, leadSources, leadStages } from './schema/index';

const STAGES = [
  { slug: 'application_received', displayName: 'Aplicação recebida', position: 1, kind: 'open' as const },
  { slug: 'under_review', displayName: 'Em análise', position: 2, kind: 'open' as const },
  { slug: 'qualified', displayName: 'Qualificado', position: 3, kind: 'open' as const },
  { slug: 'first_contact_sent', displayName: 'Primeiro contato enviado', position: 4, kind: 'open' as const },
  { slug: 'meeting_scheduled', displayName: 'Reunião agendada', position: 5, kind: 'open' as const },
  { slug: 'meeting_done', displayName: 'Reunião realizada', position: 6, kind: 'open' as const },
  { slug: 'proposal_sent', displayName: 'Proposta enviada', position: 7, kind: 'open' as const },
  { slug: 'closed_verbally', displayName: 'Fechado verbalmente', position: 8, kind: 'open' as const },
  { slug: 'contract_sent', displayName: 'Contrato enviado', position: 9, kind: 'open' as const },
  { slug: 'paid', displayName: 'Pago / Onboarding', position: 10, kind: 'won' as const },
  { slug: 'lost', displayName: 'Perdido', position: 11, kind: 'lost' as const },
];

const LOSS_REASONS = [
  { slug: 'qualificacao_reprovada', displayName: 'Qualificação reprovada' },
  { slug: 'lead_silenciou', displayName: 'Lead silenciou / não retornou' },
  { slug: 'fake_spam', displayName: 'Fake / spam' },
  { slug: 'lista_de_espera_vencida', displayName: 'Lista de espera vencida' },
  { slug: 'preco_alto', displayName: 'Preço considerado alto' },
  { slug: 'timing_ruim', displayName: 'Timing ruim' },
  { slug: 'sem_fit_pessoal', displayName: 'Sem fit pessoal' },
  { slug: 'escolheu_concorrente', displayName: 'Escolheu concorrente' },
  { slug: 'sumiu_apos_proposta', displayName: 'Sumiu após proposta' },
  { slug: 'decisao_adiada', displayName: 'Decisão adiada' },
  { slug: 'outro', displayName: 'Outro' },
];

const SOURCES = [
  { slug: 'giu_salvatore_indicacao', displayName: 'Indicação Giu Salvatore' },
  { slug: 'instagram_organico', displayName: 'Instagram orgânico (reels/post)' },
  { slug: 'indicacao_pessoal', displayName: 'Indicação pessoal' },
  { slug: 'tiktok', displayName: 'TikTok' },
  { slug: 'podcast', displayName: 'Podcast' },
  { slug: 'outro', displayName: 'Outro' },
];

async function seed() {
  console.warn('Seeding lead_stages...');
  for (const stage of STAGES) {
    await db
      .insert(leadStages)
      .values(stage)
      .onConflictDoUpdate({
        target: leadStages.slug,
        set: { displayName: stage.displayName, position: stage.position, kind: stage.kind, updatedAt: sql`now()` },
      });
  }

  console.warn('Seeding lead_loss_reasons...');
  for (const reason of LOSS_REASONS) {
    await db
      .insert(leadLossReasons)
      .values(reason)
      .onConflictDoNothing({ target: leadLossReasons.slug });
  }

  console.warn('Seeding lead_sources...');
  for (const source of SOURCES) {
    await db
      .insert(leadSources)
      .values(source)
      .onConflictDoNothing({ target: leadSources.slug });
  }

  console.warn('✅ Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
