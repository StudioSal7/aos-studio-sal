// maxDuration=300: closer faz 2 chamadas GPT-4o em série síncrona
// e transcrições longas (~1h de call) podem levar até 60-90s.
// Vercel Pro suporta até 300s em Server Actions.
export const maxDuration = 300;

import type { Route } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/server/auth';
import { PageHeader } from '@/components/ui/page-header';
import { CloserAnalysisForm } from '../_components/closer-analysis-form';

export default async function NovaAnaliseCloserPage() {
  await requireAuth();

  return (
    <div className="space-y-4 p-6">
      <Link
        href={"/analise/closer" as Route<string>}
        className="inline-flex items-center gap-1.5 text-micro text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={14} />
        voltar
      </Link>

      <PageHeader title="nova análise closer." />

      <CloserAnalysisForm />
    </div>
  );
}
