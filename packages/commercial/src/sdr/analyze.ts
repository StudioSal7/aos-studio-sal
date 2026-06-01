import { callGPT4oJSON } from '../openai';
import type {
  RunSdrAnalysisInput,
  SdrAnalysisResult,
  SdrExtractedData,
  SdrScoreBreakdown,
  SdrScoreResponse,
} from '../types';
import {
  buildSdrExtractionSystemPrompt,
  buildSdrExtractionUserPrompt,
  buildSdrScoringSystemPrompt,
  buildSdrScoringUserPrompt,
} from './prompts';

// Pesos do overall_score: conducao_agendamento 30% · qualificacao 25%
//                         rapport 20% · clareza 15% · velocidade_resposta 10%
// velocidade_resposta pode ser null → seu peso é redistribuído proporcionalmente
// entre os demais critérios (renormalização). Calculado no código.
const SDR_WEIGHTS: Record<keyof SdrScoreBreakdown, number> = {
  conducao_agendamento: 0.3,
  qualificacao: 0.25,
  rapport: 0.2,
  clareza: 0.15,
  velocidade_resposta: 0.1,
};

export function computeSdrOverallScore(breakdown: SdrScoreBreakdown): number {
  const entries = Object.entries(SDR_WEIGHTS) as [keyof SdrScoreBreakdown, number][];

  // Critérios efetivamente avaliáveis (velocidade_resposta pode ser null).
  const available = entries.filter(([key]) => {
    const v = breakdown[key];
    return typeof v === 'number' && Number.isFinite(v);
  });

  const totalWeight = available.reduce((sum, [, w]) => sum + w, 0);
  if (totalWeight === 0) return 0;

  const raw = available.reduce((sum, [key, w]) => {
    const v = breakdown[key] as number;
    return sum + v * (w / totalWeight); // renormaliza sobre os disponíveis
  }, 0);

  return Math.round(Math.max(0, Math.min(100, raw)));
}

function parseScoreResponse(raw: unknown): SdrScoreResponse {
  if (!raw || typeof raw !== 'object') throw new Error('Score response não é um objeto');
  const r = raw as Record<string, unknown>;

  const bd = r['breakdown'];
  if (!bd || typeof bd !== 'object') throw new Error('breakdown ausente na resposta de score');
  const b = bd as Record<string, unknown>;

  const breakdown: SdrScoreBreakdown = {
    velocidade_resposta: scoreOrNull(b['velocidade_resposta']),
    qualificacao: assertNumber(b['qualificacao'], 'qualificacao'),
    clareza: assertNumber(b['clareza'], 'clareza'),
    conducao_agendamento: assertNumber(b['conducao_agendamento'], 'conducao_agendamento'),
    rapport: assertNumber(b['rapport'], 'rapport'),
  };

  const summary = typeof r['summary'] === 'string' ? r['summary'] : '';
  // aplicavel default true (se o modelo omitir, assume conversa de SDR).
  const aplicavel = r['aplicavel'] === false ? false : true;
  const motivo = strOrNull(r['motivo_nao_aplicavel']);

  return {
    aplicavel,
    motivo_nao_aplicavel: aplicavel ? null : motivo,
    overall_score: computeSdrOverallScore(breakdown),
    breakdown,
    summary,
  };
}

function parseExtractionResponse(raw: unknown): SdrExtractedData {
  if (!raw || typeof raw !== 'object') throw new Error('Extraction response não é um objeto');
  const r = raw as Record<string, unknown>;

  return {
    agendou: typeof r['agendou'] === 'boolean' ? r['agendou'] : null,
    data_agendamento: strOrNull(r['data_agendamento']),
    nivel_interesse: parseNivelInteresse(r['nivel_interesse']),
    faixa_renda: strOrNull(r['faixa_renda']),
    tempo_no_nicho: strOrNull(r['tempo_no_nicho']),
    objecoes: strArrayOrNull(r['objecoes']),
    proximos_passos: strArrayOrNull(r['proximos_passos']),
    insights_adicionais: strOrNull(r['insights_adicionais']),
  };
}

/**
 * Analisa uma thread de WhatsApp de pré-venda (SDR) da Studio Sal.
 *
 * Função pura — não toca o banco. Faz 2 chamadas GPT-4o (scoring + extração)
 * e retorna o resultado estruturado. A persistência fica na server action.
 */
export async function runSdrAnalysis(input: RunSdrAnalysisInput): Promise<SdrAnalysisResult> {
  const { thread } = input;
  if (!thread.trim()) throw new Error('Thread vazia');

  const [scoreRaw, extractRaw] = await Promise.all([
    callGPT4oJSON(buildSdrScoringSystemPrompt(), buildSdrScoringUserPrompt(thread)),
    callGPT4oJSON(buildSdrExtractionSystemPrompt(), buildSdrExtractionUserPrompt(thread)),
  ]);

  const scoreResult = parseScoreResponse(scoreRaw);
  const extracted = parseExtractionResponse(extractRaw);

  return {
    applicable: scoreResult.aplicavel,
    applicabilityReason: scoreResult.motivo_nao_aplicavel,
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

/** Para velocidade_resposta: número válido ou null (degradação graciosa). */
function scoreOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.max(0, Math.min(100, n)));
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
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
