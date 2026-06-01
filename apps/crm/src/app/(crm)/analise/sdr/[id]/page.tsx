import { notFound } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/server/auth';
import { getAnalysisById } from '@/server/queries/commercial';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScoreBreakdownSdr } from '../_components/score-breakdown-sdr';
import type { SdrScoreBreakdown, SdrExtractedData } from '@repo/commercial/types';

type Props = { params: Promise<{ id: string }> };

function OverallScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? 'text-leaf' : score >= 60 ? 'text-wood' : 'text-clay';
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <span className={`text-display font-bold ${color}`}>{score}</span>
      <span className="text-micro text-ink-muted">score overall</span>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-line last:border-0">
      <dt className="text-micro text-ink-muted col-span-1">{label}</dt>
      <dd className="text-micro text-ink col-span-2 normal-case tracking-normal">{value}</dd>
    </div>
  );
}

function BoolRow({ label, value }: { label: string; value: boolean | null }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-line last:border-0">
      <dt className="text-micro text-ink-muted col-span-1">{label}</dt>
      <dd className="col-span-2">
        <Badge variant={value ? 'won' : 'fake'}>{value ? 'sim' : 'não'}</Badge>
      </dd>
    </div>
  );
}

function ArrayRow({ label, values }: { label: string; values: string[] | null }) {
  if (!values?.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-line last:border-0">
      <dt className="text-micro text-ink-muted col-span-1">{label}</dt>
      <dd className="col-span-2">
        <ul className="space-y-0.5">
          {values.map((v, i) => (
            <li key={i} className="text-micro text-ink normal-case tracking-normal">
              · {v}
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

export default async function SdrAnalysisDetailPage({ params }: Props) {
  await requireAuth();
  const { id } = await params;
  const analysis = await getAnalysisById(id);

  if (!analysis || analysis.analyzer !== 'sdr') notFound();

  const breakdown = analysis.scoreBreakdown as SdrScoreBreakdown | null;
  const extracted = analysis.extractedData as SdrExtractedData | null;

  const statusLabel: Record<string, string> = {
    concluido: 'concluído',
    processando: 'processando',
    erro: 'erro',
    pendente: 'pendente',
    nao_aplicavel: 'não aplicável',
  };
  const statusVariant: Record<string, 'won' | 'hot' | 'fake' | 'neutral'> = {
    concluido: 'won',
    processando: 'hot',
    erro: 'fake',
    pendente: 'neutral',
    nao_aplicavel: 'neutral',
  };

  return (
    <div className="space-y-4 p-6">
      <Link
        href={"/analise/sdr" as Route<string>}
        className="inline-flex items-center gap-1.5 text-micro text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={14} />
        voltar para lista
      </Link>

      <PageHeader title={analysis.title}>
        <Badge variant={statusVariant[analysis.status] ?? 'neutral'}>
          {statusLabel[analysis.status] ?? analysis.status}
        </Badge>
      </PageHeader>

      {/* Meta row */}
      <div className="flex flex-wrap gap-4 text-micro text-ink-muted normal-case tracking-normal">
        <span>análise: {analysis.callDate}</span>
        {analysis.leadName && (
          <span>
            lead:{' '}
            {analysis.leadId ? (
              <Link href={`/leads/${analysis.leadId}` as Route<string>} className="underline hover:text-ink">
                {analysis.leadName}
              </Link>
            ) : (
              analysis.leadName
            )}
          </span>
        )}
        <span>modelo: {analysis.analyzedBy}</span>
      </div>

      {/* Erro */}
      {analysis.status === 'erro' && analysis.errorMessage && (
        <Card className="border-clay p-4">
          <p className="text-micro text-clay normal-case tracking-normal">
            <strong>erro na análise:</strong> {analysis.errorMessage}
          </p>
        </Card>
      )}

      {/* Não aplicável */}
      {analysis.status === 'nao_aplicavel' && (
        <Card className="border-wood p-4">
          <p className="text-micro text-ink normal-case tracking-normal">
            <strong>conversa não é de pré-venda SDR</strong>
            {analysis.errorMessage ? ` — ${analysis.errorMessage}` : ''}. não foi pontuada.
          </p>
          <details className="group mt-3">
            <summary className="cursor-pointer select-none text-micro text-ink-muted hover:text-ink">
              ver conversa bruta
            </summary>
            <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-ink-muted leading-relaxed">
              {analysis.transcript}
            </pre>
          </details>
        </Card>
      )}

      {/* Processando */}
      {analysis.status === 'processando' && (
        <Card className="p-4">
          <p className="text-micro text-ink-muted normal-case tracking-normal">
            análise em andamento... recarregue a página em alguns instantes.
          </p>
        </Card>
      )}

      {/* Conteúdo quando concluído */}
      {analysis.status === 'concluido' && breakdown && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="flex flex-col items-center justify-center gap-6 p-6">
            {analysis.overallScore !== null && <OverallScoreRing score={analysis.overallScore} />}
            <ScoreBreakdownSdr breakdown={breakdown} />
          </Card>

          <div className="space-y-4 lg:col-span-2">
            {analysis.scoreSummary && (
              <Card className="p-5">
                <h2 className="mb-3 text-h3 text-ink">resumo da análise</h2>
                <p className="whitespace-pre-wrap text-micro text-ink normal-case tracking-normal leading-relaxed">
                  {analysis.scoreSummary}
                </p>
              </Card>
            )}

            {extracted && (
              <Card className="p-5">
                <h2 className="mb-3 text-h3 text-ink">dados extraídos</h2>
                <dl>
                  <BoolRow label="agendou?" value={extracted.agendou} />
                  <FieldRow label="data do agendamento" value={extracted.data_agendamento} />
                  <FieldRow label="nível de interesse" value={extracted.nivel_interesse} />
                  <FieldRow label="faixa de renda" value={extracted.faixa_renda} />
                  <FieldRow label="tempo no nicho" value={extracted.tempo_no_nicho} />
                  <ArrayRow label="objeções" values={extracted.objecoes} />
                  <ArrayRow label="próximos passos" values={extracted.proximos_passos} />
                  <FieldRow label="insights" value={extracted.insights_adicionais} />
                </dl>
              </Card>
            )}

            {/* Thread bruta */}
            <details className="group">
              <summary className="cursor-pointer select-none text-micro text-ink-muted hover:text-ink">
                ver conversa bruta
              </summary>
              <Card className="mt-2 p-4">
                <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-ink-muted leading-relaxed">
                  {analysis.transcript}
                </pre>
              </Card>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
