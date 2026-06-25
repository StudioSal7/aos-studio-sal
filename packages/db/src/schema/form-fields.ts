import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { uuid } from 'drizzle-orm/pg-core';
import { formFieldTypeEnum } from './enums';
import { forms } from './forms';

// Campo de um formulário. `ordem` define a sequência uma-pergunta-por-vez.
// `config` carrega o que é específico do tipo (opções de select, min/max e
// labels de escala, texto do botão). `leadMapping`/`leadEnumMap` ligam a
// resposta a uma coluna do lead (ver §2 do plano e LEAD_MAPPING_TARGETS).
export const formFields = pgTable(
  'form_fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),

    ordem: integer('ordem').notNull(),
    tipo: formFieldTypeEnum('tipo').notNull(),

    titulo: text('titulo').notNull(),
    subtitulo: text('subtitulo'),
    placeholder: text('placeholder'),
    obrigatorio: boolean('obrigatorio').notNull().default(true),

    config: jsonb('config').$type<FormFieldConfig>(),

    // Coluna do lead que esta resposta preenche (ex: 'email', 'name'). null =
    // não mapeado → vive só em form_responses.dados. Tipado em compile-time
    // via LeadMappingTarget; persistido como texto.
    leadMapping: text('lead_mapping').$type<LeadMappingTarget>(),
    // Para campos cujo leadMapping é um enum (idadeFaixa etc.): mapa EXATO
    // opção→literal do enum, ex: { "entre 19 e 24 anos": "19_a_24" }.
    // Sem heurística no submit (CLAUDE.md: dado determinístico não se chuta).
    leadEnumMap: jsonb('lead_enum_map').$type<Record<string, string>>(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    formIdx: index('form_fields_form_idx').on(table.formId),
  }),
);

export type FormFieldConfig = {
  opcoes?: string[]; // select / multi_select
  min?: number; // escala / numero
  max?: number; // escala / numero
  labelMin?: string; // escala
  labelMax?: string; // escala
  botaoTexto?: string; // boas_vindas / encerramento
};

// ---- Mapeamento campo → coluna do lead ----
// Fonte única da verdade dos alvos válidos. Mantém paridade com as colunas/enums
// de leads.ts. Subconjunto de LeadField do respondi-payload-mapper.

// Alvos de texto livre (gravados como string na coluna correspondente).
export const LEAD_MAPPING_TEXT_TARGETS = [
  'name',
  'nickname',
  'email',
  'whatsappE164',
  'instagramHandle',
  'cidade',
  'estado',
  'profissao',
  'tempoNegocio',
  'rendaFaixa',
  'orcamentoFaixa',
] as const;

// Alvos de enum (exigem leadEnumMap por opção). Devem casar com os pgEnums.
export const LEAD_MAPPING_ENUM_TARGETS = [
  'idadeFaixa',
  'abordagemPreferida',
  'tempoNoNichoFaixa',
] as const;

// Alvo especial: resolvido para leadSourceId no módulo de intake.
export const LEAD_MAPPING_SPECIAL_TARGETS = ['leadSourceSlug'] as const;

export const LEAD_MAPPING_TARGETS = [
  ...LEAD_MAPPING_TEXT_TARGETS,
  ...LEAD_MAPPING_ENUM_TARGETS,
  ...LEAD_MAPPING_SPECIAL_TARGETS,
] as const;

export type LeadMappingTarget = (typeof LEAD_MAPPING_TARGETS)[number];
export type LeadMappingEnumTarget = (typeof LEAD_MAPPING_ENUM_TARGETS)[number];

export function isEnumMappingTarget(t: LeadMappingTarget): t is LeadMappingEnumTarget {
  return (LEAD_MAPPING_ENUM_TARGETS as readonly string[]).includes(t);
}

export type FormField = typeof formFields.$inferSelect;
export type NewFormField = typeof formFields.$inferInsert;
