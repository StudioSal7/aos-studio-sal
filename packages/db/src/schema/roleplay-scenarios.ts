import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { roleplayDifficultyEnum } from './enums';

// Cenários de treino role-play SPIN. Cada cenário descreve um "lead" simulado
// pela IA (persona + contexto comercial + objeções) que a closer treina.
// Persona/contexto/objeções são DADOS aqui — o motor (@repo/commercial) só os
// recebe; nenhuma identidade de cliente fica hard-coded no core.
export const roleplayScenarios = pgTable(
  'roleplay_scenarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    name: text('name').notNull(),
    persona: text('persona').notNull(), // quem é o lead (idade, contexto, dor latente)
    context: text('context').notNull(), // situação comercial (origem, momento da jornada)
    objections: jsonb('objections').notNull(), // string[] de objeções/resistências realistas
    spinFocus: jsonb('spin_focus').notNull(), // string[] ex: ["implicacao","necessidade"]
    difficulty: roleplayDifficultyEnum('difficulty').notNull(), // quão guardado é o lead
    sourceNote: text('source_note'), // origem (ex: "extraído de transcrição X")

    active: boolean('active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeIdx: index('roleplay_scenarios_active_idx').on(table.active),
    // Nome único habilita seed idempotente (onConflictDoNothing por nome).
    nameUnique: uniqueIndex('roleplay_scenarios_name_unique').on(table.name),
  }),
);

export type RoleplayScenario = typeof roleplayScenarios.$inferSelect;
export type NewRoleplayScenario = typeof roleplayScenarios.$inferInsert;
