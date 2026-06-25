import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { roleplayMessageRoleEnum } from './enums';
import { roleplaySessions } from './roleplay-sessions';

// Mensagens da sessão de treino (append-only). Persistência É desejada aqui —
// o Rodrigo quer os dados de treino gravados para análise posterior.
// `turnIndex` ordena a conversa; cascade ao remover a sessão.
export const roleplayMessages = pgTable(
  'roleplay_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    sessionId: uuid('session_id')
      .notNull()
      .references(() => roleplaySessions.id, { onDelete: 'cascade' }),

    role: roleplayMessageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    turnIndex: integer('turn_index').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index('roleplay_messages_session_idx').on(table.sessionId),
  }),
);

export type RoleplayMessage = typeof roleplayMessages.$inferSelect;
export type NewRoleplayMessage = typeof roleplayMessages.$inferInsert;
