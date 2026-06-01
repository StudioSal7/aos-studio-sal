import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { analysisStatusEnum, analyzerEnum } from './enums';
import { leads } from './leads';
import { users } from './users';

// Análises comerciais geradas pelo motor CallScore (GPT-4o).
// Tabela única com discriminador `analyzer` ('closer' | 'sdr'). O shape de
// `scoreBreakdown`/`extractedData` (jsonb) varia por régua — tipagem forte fica
// no app (@repo/commercial), não aqui, para não inverter a dependência.
export const commercialAnalyses = pgTable(
  'commercial_analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    analyzer: analyzerEnum('analyzer').notNull(),
    // Vínculo opcional a um lead do CRM. set null para não perder a análise se o lead for removido.
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),

    title: text('title').notNull(),
    callDate: date('call_date').notNull(),
    sourceType: text('source_type'), // closer: 'fechamento' · sdr: 'whatsapp'
    sourceFile: text('source_file'), // nome do .txt no lote (idempotência)

    transcript: text('transcript').notNull(),
    durationMinutes: integer('duration_minutes'),

    overallScore: integer('overall_score'),
    scoreBreakdown: jsonb('score_breakdown'),
    scoreSummary: text('score_summary'),
    extractedData: jsonb('extracted_data'),

    status: analysisStatusEnum('status').notNull().default('pendente'),
    errorMessage: text('error_message'),
    analyzedBy: text('analyzed_by').notNull().default('gpt-4o'),

    createdBy: uuid('created_by').references(() => users.id),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    analyzerIdx: index('commercial_analyses_analyzer_idx').on(table.analyzer),
    leadIdx: index('commercial_analyses_lead_idx').on(table.leadId),
    statusIdx: index('commercial_analyses_status_idx').on(table.status),
    callDateIdx: index('commercial_analyses_call_date_idx').on(table.callDate),
    // Idempotência do lote: source_file único quando preenchido.
    sourceFileUnique: uniqueIndex('commercial_analyses_source_file_unique')
      .on(table.sourceFile)
      .where(sql`source_file IS NOT NULL`),
    overallScoreRange: check(
      'commercial_analyses_overall_score_range',
      sql`overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)`,
    ),
  }),
);

export type CommercialAnalysis = typeof commercialAnalyses.$inferSelect;
export type NewCommercialAnalysis = typeof commercialAnalyses.$inferInsert;
