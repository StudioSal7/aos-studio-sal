import { notFound } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Quote } from 'lucide-react';
import { requireAuth } from '@/server/auth';
import { getAnalysisById } from '@/server/queries/commercial';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScoreBreakdown } from '../_components/score-breakdown';
import { RecommendationCard } from '../_components/recommendation-card';
import type { CloserMethodDossier, CloserExtractedData } from '@repo/commercial/types';

type Props = { params: Promise<{ id: string }> };

function OverallScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? 'text-leaf' : score >= 60 ? 'text-wood' : 'text-clay';
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <span className={`text-display font-bold ${color}`}>{score}</span>
      <span className="text-micro text-ink-muted">score método</span>
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

// Lista de acertos/falhas com o trecho literal da transcrição.
function EvidenceList({
  items,
  accent,
}: {
  items: { texto: string; trecho: string }[];
  accent: 'leaf' | 'clay';
}) {
  const dot = accent === 'leaf' ? 'text-leaf' : 'text-clay';
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="space-y-1">
          <p className="text-micro text-ink normal-case tracking-normal">
            <span className={`font-semibold ${dot}`}>{i + 1}.</span> {it.texto}
          </p>
          {it.trecho && (
            <p className="flex gap-1.5 border-l-2 border-line pl-2.5 text-micro text-ink-muted normal-case tracking-normal italic">
              <Quote size={12} className="mt-0.5 shrink-0 opacity-60" />
              {it.trecho}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function CloserAnalysisDetailPage({ params }: Props) {
  await requireAuth();
  const { id } = await params;
  const analysis = await getAnalysisById(id);

  if (!analysis || analysis.analyzer !== 'closer') notFound();

  const dossier = analysis.scoreBreakdown as CloserMethodDossier | null;
  const extracted = analysis.extractedData as CloserExtractedData | null;

  const statusLabel: Record<string, string> = {
    concluido: 'concluído',
    processando: 'processando',
    erro: 'erro',
    pendente: 'pendente',
  };
  const statusVariant: Record<string, 'won' | 'hot' | 'fake' | 'neutral'> = {
    concluido: 'won',
    processando: 'hot',
    erro: 'fake',
    pendente: 'neutral',
  };

  const det = dossier?.deteccao;

  return (
    <div className="space-y-4 p-6">
      <Link
        href={'/analise/closer' as Route<string>}
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
        <span>call: {analysis.callDate}</span>
        {analysis.durationMinutes && <span>duração: {analysis.durationMinutes} min</span>}
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
        {analysis.rubricVersion && <span>régua: {analysis.rubricVersion}</span>}
      </div>

      {/* Erro */}
      {analysis.status === 'erro' && analysis.errorMessage && (
        <Card className="border-clay p-4">
          <p className="text-micro text-clay normal-case tracking-normal">
            <strong>erro na análise:</strong> {analysis.errorMessage}
          </p>
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
      {analysis.status === 'concluido' && dossier && det && (
        <>
          {/* Header de detecção */}
          <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
            <div className="flex items-center gap-2">
              <Badge variant={det.etapa === 'fechamento' ? 'review' : 'hot'}>{det.etapa}</Badge>
              <span className="text-micro text-ink-muted normal-case tracking-normal">
                {det.produto}
              </span>
            </div>
            <span className="text-micro text-ink-muted normal-case tracking-normal">
              decisores: {det.num_decisores}
              {det.num_decisores === 2 &&
                ` · 2º ${det.segundo_decisor_conduzido ? 'conduzido' : 'não conduzido'}`}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-micro text-ink-muted">lead</span>
              <Badge variant={det.lead_qualificado ? 'won' : 'fake'}>
                {det.lead_qualificado ? 'qualificado' : 'desqualificado'}
              </Badge>
            </span>
            {det.lead_qualificado_obs && (
              <span className="text-micro text-ink-muted normal-case tracking-normal italic">
                {det.lead_qualificado_obs}
              </span>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Score + breakdown */}
            <Card className="flex flex-col items-center justify-center gap-6 p-6">
              {analysis.overallScore !== null && <OverallScoreRing score={analysis.overallScore} />}
              <ScoreBreakdown blocos={dossier.blocos} pesos={dossier.pesos} />
            </Card>

            {/* Dossiê qualitativo */}
            <div className="space-y-4 lg:col-span-2">
              {/* Leitura em 1 linha */}
              {dossier.leitura_1_linha && (
                <Card className="border-wood p-5">
                  <h2 className="mb-1.5 text-micro text-ink-muted">leitura da call</h2>
                  <p className="text-body text-ink normal-case tracking-normal leading-relaxed">
                    {dossier.leitura_1_linha}
                  </p>
                </Card>
              )}

              {/* Desejo + Implicação — o núcleo da venda */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {dossier.analise_desejo && (
                  <Card className="p-4">
                    <h2 className="mb-2 text-h3 text-ink">desejo</h2>
                    <p className="whitespace-pre-wrap text-micro text-ink normal-case tracking-normal leading-relaxed">
                      {dossier.analise_desejo}
                    </p>
                  </Card>
                )}
                {dossier.analise_implicacao && (
                  <Card className="p-4">
                    <h2 className="mb-2 text-h3 text-ink">implicação</h2>
                    <p className="whitespace-pre-wrap text-micro text-ink normal-case tracking-normal leading-relaxed">
                      {dossier.analise_implicacao}
                    </p>
                  </Card>
                )}
              </div>

              {/* Acertos + Falhas */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {dossier.acertos.length > 0 && (
                  <Card className="p-4">
                    <h2 className="mb-3 text-h3 text-leaf">acertos</h2>
                    <EvidenceList items={dossier.acertos} accent="leaf" />
                  </Card>
                )}
                {dossier.falhas.length > 0 && (
                  <Card className="p-4">
                    <h2 className="mb-3 text-h3 text-clay">falhas</h2>
                    <EvidenceList items={dossier.falhas} accent="clay" />
                  </Card>
                )}
              </div>

              {/* Sinais vermelhos */}
              <Card className={`p-4 ${dossier.sinais_vermelhos.length > 0 ? 'border-clay' : ''}`}>
                <h2 className="mb-2 flex items-center gap-1.5 text-h3 text-ink">
                  <AlertTriangle size={14} className="text-clay" />
                  sinais vermelhos
                </h2>
                {dossier.sinais_vermelhos.length > 0 ? (
                  <ul className="space-y-1">
                    {dossier.sinais_vermelhos.map((s, i) => (
                      <li key={i} className="text-micro text-clay normal-case tracking-normal">
                        · {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-micro text-ink-muted normal-case tracking-normal">nenhum grave</p>
                )}
              </Card>

              {/* Recomendações com script */}
              {dossier.recomendacoes.length > 0 && (
                <Card className="p-5">
                  <h2 className="mb-3 text-h3 text-ink">recomendações para a próxima call</h2>
                  <div className="space-y-3">
                    {dossier.recomendacoes.map((rec, i) => (
                      <RecommendationCard key={i} rec={rec} index={i} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Dados extraídos (business intel) */}
              {extracted && (
                <Card className="p-5">
                  <h2 className="mb-3 text-h3 text-ink">dados extraídos</h2>
                  <dl>
                    <BoolRow label="fechou?" value={extracted.fechou} />
                    <FieldRow label="programa" value={extracted.programa_interesse} />
                    <FieldRow label="nível de interesse" value={extracted.nivel_interesse} />
                    <FieldRow label="orçamento mencionado" value={extracted.orcamento_mencionado} />
                    {extracted.orcamento_valor !== null && (
                      <FieldRow
                        label="valor (R$)"
                        value={extracted.orcamento_valor?.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      />
                    )}
                    <FieldRow label="pagamento" value={extracted.forma_pagamento} />
                    <FieldRow label="dor principal" value={extracted.dor_principal} />
                    <ArrayRow label="outras dores" values={extracted.dores_secundarias} />
                    <ArrayRow label="objeções" values={extracted.objecoes} />
                    <ArrayRow label="próximos passos" values={extracted.proximos_passos} />
                    <ArrayRow label="concorrentes citados" values={extracted.concorrentes_mencionados} />
                    <FieldRow label="insights" value={extracted.insights_adicionais} />
                  </dl>
                </Card>
              )}

              {/* Transcrição bruta */}
              <details className="group">
                <summary className="cursor-pointer select-none text-micro text-ink-muted hover:text-ink">
                  ver transcrição bruta
                </summary>
                <Card className="mt-2 p-4">
                  <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-ink-muted leading-relaxed">
                    {analysis.transcript}
                  </pre>
                </Card>
              </details>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
