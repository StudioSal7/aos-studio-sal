import { boolean, index, integer, jsonb, pgTable, timestamp } from 'drizzle-orm/pg-core';
import { uuid } from 'drizzle-orm/pg-core';
import { forms } from './forms';
import { leads } from './leads';

// Resposta crua de um formulário (auditoria de produto). `dados` guarda o payload
// literal { fieldId: answer }; `leadId` é preenchido após o intake criar/casar o
// lead (set null se o lead for removido). O evento de funil em si é logado à parte
// em lead_intake_log (source='formulario_web') — as duas tabelas coexistem.
export const formResponses = pgTable(
  'form_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),

    dados: jsonb('dados').$type<Record<string, unknown>>().notNull(), // { fieldId: answer }
    metadata: jsonb('metadata').$type<FormResponseMetadata>(),

    iniciadoEm: timestamp('iniciado_em', { withTimezone: true }),
    concluidoEm: timestamp('concluido_em', { withTimezone: true }).notNull().defaultNow(),
    tempoPreenchimentoSeg: integer('tempo_preenchimento_seg'),
    parcial: boolean('parcial').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    formIdx: index('form_responses_form_idx').on(table.formId),
    leadIdx: index('form_responses_lead_idx').on(table.leadId),
  }),
);

export type FormResponseMetadata = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
};

export type FormResponse = typeof formResponses.$inferSelect;
export type NewFormResponse = typeof formResponses.$inferInsert;
