// maxDuration=300: a rota hospeda a análise final (runRoleplayAnalysis → 1 chamada
// gpt-4o). Os turnos de chat são rápidos; o teto cobre o "encerrar e avaliar".
export const maxDuration = 300;

import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/server/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { getSessionWithMessages } from '@/server/queries/treino';
import { Chat } from './_components/chat';
import { FeedbackDossier } from './_components/feedback-dossier';

const DIFFICULTY_LABEL: Record<string, string> = {
  facil: 'fácil',
  medio: 'médio',
  dificil: 'difícil',
};

export default async function TreinoSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireAuth();
  const { sessionId } = await params;
  const session = await getSessionWithMessages(sessionId);
  if (!session) notFound();

  const concluded = session.status === 'concluida' && session.feedback;

  return (
    <div className="space-y-4 p-6">
      <Link
        href={"/comercial/treino" as Route<string>}
        className="inline-flex items-center gap-1.5 text-micro text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={14} />
        voltar
      </Link>

      <PageHeader title={`treino · ${session.scenarioName}`} />

      {/* Contexto do cenário */}
      <Card className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-ink-muted">
          <span>treinando: {session.traineeLabel}</span>
          <span>dificuldade: {DIFFICULTY_LABEL[session.difficulty] ?? session.difficulty}</span>
          {session.leadName && <span>lead: {session.leadName}</span>}
        </div>
        <p className="text-micro text-ink-muted normal-case tracking-normal">{session.persona}</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chat */}
        <Card className="flex h-[70vh] flex-col p-4">
          <Chat
            sessionId={session.id}
            initialMessages={session.messages}
            status={session.status}
          />
        </Card>

        {/* Feedback (após encerrar) */}
        <div>
          {concluded && session.feedback ? (
            <FeedbackDossier
              overallScore={session.overallScore}
              breakdown={session.breakdown}
              feedback={session.feedback}
            />
          ) : (
            <Card className="flex h-full items-center justify-center p-8">
              <p className="text-center text-micro text-ink-muted normal-case tracking-normal">
                Treine a conversa e clique em <strong>encerrar e avaliar</strong> para receber o
                feedback SPIN com nota e exemplos de reescrita.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
