'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { requireAuth } from '@/server/auth';
import type { ActionResult } from '@/server/actions/leads';

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function inviteUserAction(
  email: string,
  role: 'sdr' | 'closer',
): Promise<ActionResult<{ userId: string }>> {
  const auth = await requireAuth();

  if (auth.role !== 'owner') {
    return { ok: false, error: 'forbidden' };
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Check not already registered
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, trimmedEmail))
    .limit(1);

  if (existing) {
    return { ok: false, error: 'already_registered' };
  }

  // Create row in our users table first (so requireAuth works after invite is accepted)
  const [newUser] = await db
    .insert(schema.users)
    .values({ email: trimmedEmail, role, pendingInvite: true })
    .returning({ id: schema.users.id });

  if (!newUser) {
    return { ok: false, error: 'db_insert_failed' };
  }

  // Send Supabase invite email
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(trimmedEmail, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/callback`,
  });

  if (error) {
    // Roll back the users row if Supabase invite fails
    await db.delete(schema.users).where(eq(schema.users.id, newUser.id));
    return { ok: false, error: `supabase_invite_failed:${error.message}` };
  }

  revalidatePath('/admin');
  return { ok: true, data: { userId: newUser.id } };
}

export async function updateUserRoleAction(
  userId: string,
  role: 'sdr' | 'closer',
): Promise<ActionResult> {
  const auth = await requireAuth();

  if (auth.role !== 'owner') {
    return { ok: false, error: 'forbidden' };
  }

  await db
    .update(schema.users)
    .set({ role, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));

  revalidatePath('/admin');
  return { ok: true };
}

export async function listUsersAction(): Promise<
  ActionResult<Array<{ id: string; email: string; role: string; pendingInvite: boolean }>>
> {
  const auth = await requireAuth();

  if (auth.role !== 'owner') {
    return { ok: false, error: 'forbidden' };
  }

  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.users.role,
      pendingInvite: schema.users.pendingInvite,
    })
    .from(schema.users)
    .orderBy(schema.users.createdAt);

  return { ok: true, data: users };
}
