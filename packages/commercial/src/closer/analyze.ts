import { callGPT4oJSON } from '../openai';
import type {
  CloserAnalysisResult,
  CloserExtractedData,
  CloserScoreBreakdown,
  CloserScoreResponse,
  RunCloserAnalysisInput,
} from '../types';
import {
  buildCloserExtractionSystemPrompt,
  buildCloserExtractionUserPrompt,
  buildCloserScoringSystemPrompt,
  buildCloserScoringUserPrompt,
} from './prompts';

// Pesos do overall_score: fechamento 30% · conducao 20% · tecnica_vendas 20%
//                         escuta_ativa 10% · clareza 10% · rapport 10%
// Calculado no código (não confiamos na aritmética do modelo).
const CLOSER_WEIGHTS: Record<keyof CloserScoreBreakdown, number> = {
  fechamento: 0.3,
  conducao: 0.2,
  tecnica_vendas: 0.2,
  escuta_ativa: 0.1,
  clareza: 0.1,
  rapport: 0.1,
};

export function computeCloserOverallScore(breakdown: CloserScoreBreakdown): number {
  const raw =
    breakdown.fechamento * CLOSER_WEIGHTS.fechamento +
    breakdown.conducao * CLOSER_WEIGHTS.conducao +
    breakdown.tecnica_vendas * CLOSER_WEIGHTS.tecnica_vendas +
    breakdown.escuta_ativa * CLOSER_WEIGHTS.escuta_ativa +
    breakdown.clareza * CLOSER_WEIGHTS.clareza +
    breakdown.rapport * CLOSER_WEIGHTS.rapport;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

function parseScoreResponse(raw: unknown): CloserScoreResponse {
  if (!raw || typeof raw !== 'object') throw new Error('Score response não é um objeto');
  const r = raw as Record<string, unknown>;

  const bd = r['breakdown'];
  if (!bd || typeof bd !== 'object') throw new Error('breakdown ausente na resposta de score');
  const b = bd as Record<string, unknown>;

  const breakdown: CloserScoreBreakdown = {
    escuta_ativa: assertNumber(b['escuta_ativa'], 'escuta_ativa'),
    clareza: assertNumber(b['clareza'], 'clareza'),
    tecnica_vendas: assertNumber(b['tecnica_vendas'], 'tecnica_vendas'),
    conducao: assertNumber(b['conducao'], 'conducao'),
    rapport: assertNumber(b['rapport'], 'rapport'),
    fechamento: assertNumber(b['fechamento'], 'fechamento'),
  };

  const summary = typeof r['summary'] === 'string' ? r['summary'] : '';

  return {
    overall_score: computeCloserOverallScore(breakdown),
    breakdown,
    summary,
  };
}

function parseExtractionResponse(raw: unknown): CloserExtractedData {
  if (!raw || typeof raw !== 'object') throw new Error('Extraction response não é um objeto');
  const r = raw as Record<string, unknown>;

  return {
    fechou: typeof r['fechou'] === 'boolean' ? r['fechou'] : null,
    dor_principal: strOrNull(r['dor_principal']),
    dores_secundarias: strArrayOrNull(r['dores_secundarias']),
    programa_interesse: strOrNull(r['programa_interesse']),
    orcamento_mencionado: strOrNull(r['orcamento_mencionado']),
    orcamento_valor: numOrNull(r['orcamento_valor']),
    forma_pagamento: strOrNull(r['forma_pagamento']),
    objecoes: strArrayOrNull(r['objecoes']),
    nivel_interesse: parseNivelInteresse(r['nivel_interesse']),
    proximos_passos: strArrayOrNull(r['proximos_passos']),
    concorrentes_mencionados: strArrayOrNull(r['concorrentes_mencionados']),
    insights_adicionais: strOrNull(r['insights_adicionais']),
  };
}

/**
 * Analisa uma transcrição de call de fechamento da Studio Sal.
 *
 * Função pura — não toca o banco. Faz 2 chamadas GPT-4o (scoring + extração)
 * e retorna o resultado estruturado. A persistência fica na server action.
 */
export async function runCloserAnalysis(
  input: RunCloserAnalysisInput,
): Promise<CloserAnalysisResult> {
  const { transcript } = input;
  if (!transcript.trim()) throw new Error('Transcrição vazia');

  const [scoreRaw, extractRaw] = await Promise.all([
    callGPT4oJSON(buildCloserScoringSystemPrompt(), buildCloserScoringUserPrompt(transcript)),
    callGPT4oJSON(
      buildCloserExtractionSystemPrompt(),
      buildCloserExtractionUserPrompt(transcript),
    ),
  ]);

  const scoreResult = parseScoreResponse(scoreRaw);
  const extracted = parseExtractionResponse(extractRaw);

  return {
    overallScore: scoreResult.overall_score,
    breakdown: scoreResult.breakdown,
    summary: scoreResult.summary,
    extracted,
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function assertNumber(v: unknown, field: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Campo "${field}" não é número: ${String(v)}`);
  return Math.round(Math.max(0, Math.min(100, n)));
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strArrayOrNull(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const arr = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return arr.length > 0 ? arr : null;
}

function parseNivelInteresse(v: unknown): 'baixo' | 'medio' | 'alto' | null {
  if (v === 'baixo' || v === 'medio' || v === 'alto') return v;
  return null;
}
