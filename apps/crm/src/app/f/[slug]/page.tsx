import { notFound } from 'next/navigation';
import { FormRuntime } from '@/components/forms/form-runtime';
import { getActiveFormBySlug } from '@/server/queries/forms';

export const runtime = 'nodejs';
// Sempre dinâmico: o conteúdo (status do form) e os UTMs vêm em runtime.
export const dynamic = 'force-dynamic';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const form = await getActiveFormBySlug(slug);
  if (!form) notFound();

  // Captura UTM só quando o form pede (config.coletarUtm).
  let utm: Record<string, string | null> | undefined;
  if (form.config?.coletarUtm) {
    const sp = await searchParams;
    utm = {};
    for (const key of UTM_KEYS) {
      const raw = sp[key];
      utm[key] = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? null) : null;
    }
  }

  return <FormRuntime form={form} utm={utm} />;
}
