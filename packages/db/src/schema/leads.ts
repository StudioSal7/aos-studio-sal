import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  abordagemPreferidaEnum,
  idadeFaixaEnum,
  nextActionTypeEnum,
  tempoNoNichoFaixaEnum,
} from './enums';
import { leadLossReasons } from './lead-loss-reasons';
import { leadSources } from './lead-sources';
import { leadStages } from './lead-stages';
import { products } from './products';
import { users } from './users';

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Identification
    name: text('name'),
    nickname: text('nickname'),
    whatsappE164: text('whatsapp_e164'),
    whatsappDigitsOnly: text('whatsapp_digits_only').generatedAlwaysAs(
      sql`regexp_replace(whatsapp_e164, '\D', '', 'g')`,
    ),
    email: text('email'),
    instagramHandle: text('instagram_handle'),
    cidade: text('cidade'),
    estado: text('estado'),

    // Source
    leadSourceId: uuid('lead_source_id').references(() => leadSources.id),
    leadSourceOther: text('lead_source_other'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmTerm: text('utm_term'),
    utmContent: text('utm_content'),
    // Respondi.app respondent_id for idempotency at lead level
    intakeRespondentId: text('intake_respondent_id').unique(),

    // Qualification
    idadeFaixa: idadeFaixaEnum('idade_faixa'),
    abordagemPreferida: abordagemPreferidaEnum('abordagem_preferida'),
    tempoNoNichoFaixa: tempoNoNichoFaixaEnum('tempo_no_nicho_faixa'),
    rendaFaixa: text('renda_faixa'),
    orcamentoFaixa: text('orcamento_faixa'),
    pontuacao: integer('pontuacao'),
    profissao: text('profissao'),
    tempoNegocio: text('tempo_negocio'),
    ehClienteAnterior: boolean('eh_cliente_anterior').notNull().default(false),
    produtoInteresseId: uuid('produto_interesse_id').references(() => products.id),

    // Comercial
    stageId: uuid('stage_id')
      .notNull()
      .references(() => leadStages.id),
    nextActionAt: timestamp('next_action_at', { withTimezone: true }),
    nextActionType: nextActionTypeEnum('next_action_type'),
    nextActionNotes: text('next_action_notes'),
    sdrId: uuid('sdr_id').references(() => users.id),
    closerId: uuid('closer_id').references(() => users.id),
    valorProposto: numeric('valor_proposto', { precision: 12, scale: 2 }),
    formaPagamentoNegociada: text('forma_pagamento_negociada'),
    motivoPerdaId: uuid('motivo_perda_id').references(() => leadLossReasons.id),

    // Review flags
    needsManualReview: boolean('needs_manual_review').notNull().default(false),
    manualReviewReason: text('manual_review_reason'),
    requiresAttention: boolean('requires_attention').notNull().default(false),
    requiresAttentionReason: text('requires_attention_reason'),
    marcadoFake: boolean('marcado_fake').notNull().default(false),

    // Context
    notes: text('notes'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    stageIdx: index('leads_stage_idx').on(table.stageId),
    sdrIdx: index('leads_sdr_idx').on(table.sdrId),
    closerIdx: index('leads_closer_idx').on(table.closerId),
    nextActionAtIdx: index('leads_next_action_at_idx').on(table.nextActionAt),
    needsReviewIdx: index('leads_needs_review_idx')
      .on(table.needsManualReview)
      .where(sql`needs_manual_review = true`),
    requiresAttentionIdx: index('leads_requires_attention_idx')
      .on(table.requiresAttention)
      .where(sql`requires_attention = true`),
    deletedAtIdx: index('leads_deleted_at_idx').on(table.deletedAt),
    emailIdx: index('leads_email_idx').on(table.email),
    whatsappDigitsIdx: index('leads_whatsapp_digits_idx').on(table.whatsappDigitsOnly),
    // pg_trgm GIN indexes for fuzzy search.
    // Extension `pg_trgm` must be created in the database before push/migrate:
    //   CREATE EXTENSION IF NOT EXISTS pg_trgm;
    nameTrgm: index('leads_name_trgm').using('gin', sql`${table.name} gin_trgm_ops`),
    nicknameTrgm: index('leads_nickname_trgm').using('gin', sql`${table.nickname} gin_trgm_ops`),
    emailTrgm: index('leads_email_trgm').using('gin', sql`${table.email} gin_trgm_ops`),
    instagramTrgm: index('leads_instagram_trgm').using(
      'gin',
      sql`${table.instagramHandle} gin_trgm_ops`,
    ),
  }),
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
