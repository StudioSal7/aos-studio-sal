import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { uuid } from 'drizzle-orm/pg-core';
import { formStatusEnum } from './enums';

// Formulário self-hosted (Typeform-style) que substitui o Respondi.app.
// O owner cria/edita via builder; o link público é /f/<slug>.
// `config` guarda o tema mínimo + comportamento (override de cor, mensagem
// final, redirect pós-envio, captura de UTM) — shape em FormConfig abaixo.
export const forms = pgTable(
  'forms',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    titulo: text('titulo').notNull(),
    descricao: text('descricao'),
    slug: text('slug').notNull().unique(), // usado na rota pública /f/<slug>

    status: formStatusEnum('status').notNull().default('rascunho'),

    config: jsonb('config').$type<FormConfig>(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index('forms_status_idx').on(table.status),
  }),
);

// Tema/comportamento por formulário.
export type FormConfig = {
  corPrimaria?: string | null; // override do acento; null/undefined → token wood
  mensagemFinal?: string | null; // texto da tela de encerramento
  redirecionarUrl?: string | null; // redireciona após o envio, se setado
  coletarUtm?: boolean; // captura utm_* da query na resposta
  logoUrl?: string | null;
  backgroundImage?: string | null; // URL relativa (/sal-fundo.jpg) ou absoluta
};

export type Form = typeof forms.$inferSelect;
export type NewForm = typeof forms.$inferInsert;
