import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Contas Google conectadas ao CRM (OAuth, agenda da Renata no v1).
 * Multi-conta ready: N linhas possíveis; o v1 usa a única ativa.
 * Tokens nunca saem do server — nunca selecionar access/refresh token
 * em queries que alimentam UI, nunca logar.
 */
export const googleAccounts = pgTable('google_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  googleEmail: text('google_email').notNull().unique(),
  // Nullable: desconectar anula os tokens mas preserva a linha (histórico + FK).
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  scope: text('scope').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastSyncError: text('last_sync_error'),
  connectedByUserId: uuid('connected_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // RLS declarado no schema (não só na migration) — senão `db:push` introspecta
  // o banco com RLS ligado vs TS sem enableRLS() e emite DISABLE ROW LEVEL SECURITY.
}).enableRLS();

export type GoogleAccount = typeof googleAccounts.$inferSelect;
export type NewGoogleAccount = typeof googleAccounts.$inferInsert;
