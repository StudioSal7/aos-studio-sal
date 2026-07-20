/**
 * POST /api/google/oauth/start — inicia a conexão da conta Google (owner only).
 *
 * Gera o state anti-CSRF em cookie httpOnly e devolve a URL de consentimento;
 * o client redireciona via window.location. Auth manual (JSON 401/403, não
 * redirect): o middleware isenta /api/*, então validamos sessão + role aqui.
 */

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildAuthUrl } from '@/server/lib/google-calendar';

export const runtime = 'nodejs';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [dbUser] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.email, user.email))
    .limit(1);

  if (dbUser?.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return NextResponse.json({ url: buildAuthUrl(state) });
}
