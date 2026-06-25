import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { roleplaySessionStatusEnum } from './enums';
import { leads } from './leads';
import { roleplayScenarios } from './roleplay-scenarios';

// Sessão de treino role-play. Vincula um cenário a quem treina (trainee_label,
// derivado de users.role='closer' na UI mas gravado como texto livre — nada
// hard-coded no core). Score/feedback ficam null até "encerrar e avaliar".
export const roleplaySessions = pgTable(
  'roleplay_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    scenarioId: uuid('scenario_id')
      .notNull()
      .references(() => roleplayScenarios.id),
    // Vínculo opcional a um lead real (treinando pra um deal específico).
    // set null para não perder a sessão de treino se o lead for removido.
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),

    traineeLabel: text('trainee_label').notNull(), // quem está treinando
    rubricVersion: text('rubric_version').notNull(), // ex: 'roleplay-spin-v1'

    status: roleplaySessionStatusEnum('status').notNull().default('em_andamento'),

    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    overallScore: integer('overall_score'), // null até concluir
    scoreBreakdown: jsonb('score_breakdown'), // nota_0_10 por critério (shape-agnóstico)
    feedback: jsonb('feedback'), // dossiê estruturado

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    scenarioIdx: index('roleplay_sessions_scenario_idx').on(table.scenarioId),
    leadIdx: index('roleplay_sessions_lead_idx').on(table.leadId),
    traineeIdx: index('roleplay_sessions_trainee_idx').on(table.traineeLabel),
    statusIdx: index('roleplay_sessions_status_idx').on(table.status),
    overallScoreRange: check(
      'roleplay_sessions_overall_score_range',
      sql`overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)`,
    ),
  }),
);

export type RoleplaySession = typeof roleplaySessions.$inferSelect;
export type NewRoleplaySession = typeof roleplaySessions.$inferInsert;
