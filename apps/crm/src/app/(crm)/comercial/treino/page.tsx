import type { Route } from 'next';
import Link from 'next/link';
import { Settings2 } from 'lucide-react';
import { requireAuth } from '@/server/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getCloserOptions,
  getTraineeTrends,
  listScenarios,
  listSessions,
} from '@/server/queries/treino';
import { StartSessionForm } from './_components/start-session-form';
import { TraineeTrends } from './_components/trainee-trends';

const DIFFICULTY_LABEL: Record<string, string> = {
  facil: 'fácil',
  medio: 'médio',
  dificil: 'difícil',
};

const STATUS_LABEL: Record<string, string> = {
  em_andamento: 'em andamento',
  concluida: 'concluída',
  abandonada: 'abandonada',
};

export default async function TreinoPage({
  searchParams,
}: {
  searchParams: Promise<{ trainee?: string }>;
}) {
  await requireAuth();
  const { trainee } = await searchParams;

  const [scenarios, closers, sessions, trend] = await Promise.all([
    listScenarios({ activeOnly: true }),
    getCloserOptions(),
    listSessions({ traineeLabel: trainee, limit: 30 }),
    getTraineeTrends(trainee),
  ]);

  return (
    <div className="space-y-8 p-6">
      <PageHeader title="treino spin.">
        <Link href={"/comercial/treino/cenarios" as Route<string>}>
          <Button variant="outline" size="sm">
            <Settings2 size={16} className="mr-1.5" />
            cenários
          </Button>
        </Link>
      </PageHeader>

      {/* Filtro por trainee */}
      {closers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-micro text-ink-muted">filtrar:</span>
          <FilterChip label="todos" href="/comercial/treino" active={!trainee} />
          {closers.map((c) => (
            <FilterChip
              key={c.id}
              label={c.label}
              href={`/comercial/treino?trainee=${encodeURIComponent(c.label)}`}
              active={trainee === c.label}
            />
          ))}
        </div>
      )}

      {/* Tendência (Fatia E) */}
      <section>
        <h2 className="mb-3 text-h3 text-ink">
          tendência{trainee ? ` · ${trainee}` : ''}.
        </h2>
        <TraineeTrends trend={trend} />
      </section>

      {/* Iniciar treino */}
      <section>
        <h2 className="mb-3 text-h3 text-ink">iniciar treino.</h2>
        <Card className="p-6">
          <StartSessionForm scenarios={scenarios} closers={closers} />
        </Card>
      </section>

      {/* Histórico de sessões */}
      <section>
        <h2 className="mb-3 text-h3 text-ink">sessões{trainee ? ` · ${trainee}` : ''}.</h2>
        <Card className="overflow-hidden p-0">
          {sessions.length === 0 ? (
            <p className="p-6 text-micro text-ink-muted normal-case tracking-normal">
              Nenhuma sessão ainda.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/comercial/treino/${s.id}` as Route<string>}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-canvas"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-body text-ink normal-case">{s.scenarioName}</p>
                      <p className="text-micro text-ink-muted normal-case tracking-normal">
                        {s.traineeLabel} · {STATUS_LABEL[s.status] ?? s.status} ·{' '}
                        {s.startedAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                      </p>
                    </div>
                    <span className="shrink-0 text-h3 text-ink">
                      {s.overallScore ?? '—'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href as Route<string>}
      className={
        active
          ? 'border border-ink bg-ink px-3 py-1 text-micro text-paper'
          : 'border border-line bg-paper px-3 py-1 text-micro text-ink-muted hover:text-ink'
      }
    >
      {label}
    </Link>
  );
}
