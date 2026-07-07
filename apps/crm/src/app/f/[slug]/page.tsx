import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FormRuntime } from '@/components/forms/form-runtime';
import { getActiveFormBySlug } from '@/server/queries/forms';

export const runtime = 'nodejs';
// Sempre dinâmico: o conteúdo (status do form) e os UTMs vêm em runtime.
export const dynamic = 'force-dynamic';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

// Preview de link (WhatsApp/redes) por formulário. Sem isto, cai no metadata
// global do CRM ('a revolução.' / 'CRM Fase 1') — o codinome interno vaza no
// form do cliente. Puxa titulo/descricao/backgroundImage do próprio form.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const form = await getActiveFormBySlug(slug);
  if (!form) return { title: 'Formulário' };

  const title = form.titulo ?? 'Formulário';
  const description = form.descricao ?? undefined;
  const image = form.config?.backgroundImage ?? undefined;

  return {
    title,
    description,
    // Formulário de captação: fora dos buscadores.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

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
