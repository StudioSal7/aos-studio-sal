'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function loginAction(formData: FormData) {
  const email = (formData.get('email') as string | null)?.trim();
  const password = formData.get('password') as string | null;

  if (!email || !password) {
    redirect('/login?error=missing_fields');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect('/login?error=invalid_credentials');
  }

  redirect('/');
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
