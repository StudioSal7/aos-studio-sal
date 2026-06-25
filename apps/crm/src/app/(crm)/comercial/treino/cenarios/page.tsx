// maxDuration=60: a extração de rascunho (scenarioFromTranscript) faz 1 chamada
// gpt-4o curta. Não é a análise final (essa fica em [sessionId] com teto 300).
export const maxDuration = 60;

import type { Route } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/server/auth';
import { PageHeader } from '@/components/ui/page-header';
import { listScenariosDetailed } from '@/server/queries/treino';
import { ScenarioManager } from './_components/scenario-manager';

export default async function CenariosPage() {
  await requireAuth();
  const scenarios = await listScenariosDetailed();

  return (
    <div className="space-y-4 p-6">
      <Link
        href={"/comercial/treino" as Route<string>}
        className="inline-flex items-center gap-1.5 text-micro text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={14} />
        voltar
      </Link>

      <PageHeader title="cenários de treino." />

      <ScenarioManager scenarios={scenarios} />
    </div>
  );
}
