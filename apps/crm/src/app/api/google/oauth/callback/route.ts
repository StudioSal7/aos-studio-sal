/**
 * GET /api/google/oauth/callback — retorno do consentimento Google.
 *
 * Valida state (cookie httpOnly) + sessão owner, troca o code por tokens e
 * faz upsert em google_accounts por google_email (reconectar reativa a conta).
 * Sempre redireciona pra /admin com ?google= / ?google_error= — nunca expõe
 * tokens ou detalhes de erro na URL.
 */

import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { exchangeCode } from '@/server/lib/google-calendar';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));

  const cookieStore = await cookies();
  const savedState = cookieStore.get('google_oauth_state')?.value;
  cookieStore.delete('google_oauth_state');

  if (searchParams.get('error')) {
    // Usuário negou o consentimento na tela do Google.
    return redirectTo('/admin?google_error=denied');
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state || !savedState || savedState !== state) {
    return redirectTo('/admin?google_error=state');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return redirectTo('/login');
  }

  const [dbUser] = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.email, user.email))
    .limit(1);

  if (dbUser?.role !== 'owner') {
    return redirectTo('/admin?google_error=forbidden');
  }

  try {
    const tokens = await exchangeCode(code);

    await db
      .insert(schema.googleAccounts)
      .values({
        googleEmail: tokens.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.tokenExpiresAt,
        scope: tokens.scope,
        isActive: true,
        lastSyncError: null,
        connectedByUserId: dbUser.id,
      })
      .onConflictDoUpdate({
        target: schema.googleAccounts.googleEmail,
        set: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.tokenExpiresAt,
          scope: tokens.scope,
          isActive: true,
          lastSyncError: null,
          connectedByUserId: dbUser.id,
          updatedAt: new Date(),
        },
      });

    return redirectTo('/admin?google=connected');
  } catch (err) {
    console.error(
      'Google OAuth callback falhou:',
      err instanceof Error ? err.message : 'unknown',
    );
    return redirectTo('/admin?google_error=exchange');
  }
}
