#!/usr/bin/env tsx
/**
 * Create (or upsert) a CRM user directly — no invite email.
 *
 * Creates a Supabase Auth user with a password (email pre-confirmed) and the
 * matching row in our `users` table (pending_invite=false). Safe to re-run:
 * if the auth user or the DB row already exists, it is updated in place.
 *
 * Usage:
 *   pnpm --filter crm create-user -- <email> <password> <role> [name]
 *   role ∈ owner | sdr | closer   (owner = admin: only role with /admin access)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL
 * in the environment (loaded from apps/crm/.env.local via tsx --env-file).
 */

import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';

const ROLES = ['owner', 'sdr', 'closer'] as const;
type Role = (typeof ROLES)[number];

async function main() {
  const [emailArg, password, roleArg, ...nameParts] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const role = roleArg as Role;
  const name = nameParts.join(' ').trim() || null;

  if (!email || !password || !role) {
    throw new Error('Usage: create-user -- <email> <password> <role> [name]');
  }
  if (!ROLES.includes(role)) {
    throw new Error(`Invalid role "${role}". Must be one of: ${ROLES.join(', ')}`);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 1. Create the Supabase Auth user (or update password if it already exists).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr) {
    // Already registered in Supabase Auth → find it and reset the password.
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
    if (!existing) {
      throw new Error(`Supabase createUser failed and user not found: ${createErr.message}`);
    }
    await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    console.log(`↻ Supabase auth user already existed — password reset (${existing.id})`);
  } else {
    console.log(`✓ Supabase auth user created (${created.user?.id})`);
  }

  // 2. Upsert our users row (auth matches by email; pending_invite=false).
  const [existingRow] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existingRow) {
    await db
      .update(schema.users)
      .set({ role, name, pendingInvite: false, deletedAt: null, updatedAt: new Date() })
      .where(eq(schema.users.id, existingRow.id));
    console.log(`↻ users row updated (${existingRow.id}) → role=${role}`);
  } else {
    const [row] = await db
      .insert(schema.users)
      .values({ email, name, role, pendingInvite: false })
      .returning({ id: schema.users.id });
    console.log(`✓ users row created (${row?.id}) → role=${role}`);
  }

  console.log(`\nDone. ${email} can log in with the provided password.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
