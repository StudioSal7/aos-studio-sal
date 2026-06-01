/**
 * requireAuth — validate session + look up role in Drizzle users table.
 *
 * Call this at the top of every Server Action and Server Component that needs auth.
 * Redirects to /login if no valid session exists.
 * Redirects to /login?error=not_registered if the Supabase user has no matching row
 * in our users table (e.g. user was deleted or never invited through the CRM admin).
 */

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AuthContext = {
  userId: string;
  supabaseUserId: string;
  email: string;
  role: 'owner' | 'sdr' | 'closer';
};

export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect('/login');
  }

  const [dbUser] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.users.role,
    })
    .from(schema.users)
    .where(eq(schema.users.email, user.email))
    .limit(1);

  if (!dbUser) {
    redirect('/login?error=not_registered');
  }

  return {
    userId: dbUser.id,
    supabaseUserId: user.id,
    email: dbUser.email,
    role: dbUser.role,
  };
}

export function requireRole(ctx: AuthContext, role: 'owner'): void {
  if (ctx.role !== role) {
    redirect('/');
  }
}
