import { callGPT4oJSON, OPENAI_MODEL } from '../openai';
import type {
  RoleplayAnalysisResult,
  RoleplayEvidence,
  RoleplayFeedbackDossier,
  RoleplayModelQuestion,
  RoleplayQuestionRewrite,
  RoleplayScoreBreakdown,
  RunRoleplayAnalysisInput,
} from '../types';
import {
  buildRoleplayAnalysisSystemPrompt,
  buildRoleplayAnalysisUserPrompt,
} from './prompts';
import { computeRoleplayOverallScore } from './rubric';

// Folga generosa pro dossiê (JSON); guarda de truncamento em openai.ts.
const MAX_OUTPUT_TOKENS = 4096;

/**
 * Avalia uma sessão de treino role-play SPIN.
 *
 * Função pura — não toca o banco. Faz 1 chamada gpt-4o unificada (notas por
 * critério + dossiê de feedback) e calcula a nota global NO CÓDIGO a partir das
 * nota_0_10. O modelo nunca devolve a nota global. Persistência fica na action.
 */
export async function runRoleplayAnalysis(
  input: RunRoleplayAnalysisInput,
): Promise<RoleplayAnalysisResult> {
  const { transcript } = input;
  if (!transcript.trim()) throw new Error('Transcrição vazia');

  const raw = await callGPT4oJSON(
    buildRoleplayAnalysisSystemPrompt(),
    buildRoleplayAnalysisUserPrompt(transcript),
    { maxTokens: MAX_OUTPUT_TOKENS },
  );

  const feedback = parseFeedbackResponse(raw);
  const overallScore = computeRoleplayOverallScore(feedback.notas);

  return {
    overallScore,
    breakdown: feedback.notas,
    feedback,
    summary: feedback.leitura_1_linha,
    model: OPENAI_MODEL,
  };
}

// ── parsing ───────────────────────────────────────────────────────────────

function parseFeedbackResponse(raw: unknown): RoleplayFeedbackDossier {
  if (!raw || typeof raw !== 'object') throw new Error('Resposta não é um objeto');
  const r = raw as Record<string, unknown>;

  const nd = r['notas'];
  if (!nd || typeof nd !== 'object') throw new Error('notas ausente na resposta');
  const n = nd as Record<string, unknown>;
  const notas: RoleplayScoreBreakdown = {
    situacao: assertNota0a10(n['situacao'], 'situacao'),
    problema: assertNota0a10(n['problema'], 'problema'),
    implicacao: assertNota0a10(n['implicacao'], 'implicacao'),
    necessidade: assertNota0a10(n['necessidade'], 'necessidade'),
    conducao_escuta: assertNota0a10(n['conducao_escuta'], 'conducao_escuta'),
  };

  return {
    leitura_1_linha: strOrEmpty(r['leitura_1_linha']),
    notas,
    melhores_momentos: parseEvidences(r['melhores_momentos']),
    perguntas_fracas: parseRewrites(r['perguntas_fracas']),
    perguntas_modelo: parseModelQuestions(r['perguntas_modelo']),
    proximo_foco: strOrEmpty(r['proximo_foco']),
  };
}

function parseEvidences(v: unknown): RoleplayEvidence[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const texto = strOrNull(o['texto']);
      if (!texto) return null;
      return { texto, trecho: strOrNull(o['trecho']) ?? '' };
    })
    .filter((x): x is RoleplayEvidence => x !== null);
}

function parseRewrites(v: unknown): RoleplayQuestionRewrite[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const original = strOrNull(o['original']);
      const reescrita = strOrNull(o['reescrita']);
      if (!original && !reescrita) return null;
      return { original: original ?? '', reescrita: reescrita ?? '' };
    })
    .filter((x): x is RoleplayQuestionRewrite => x !== null);
}

function parseModelQuestions(v: unknown): RoleplayModelQuestion[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const pergunta = strOrNull(o['pergunta']);
      if (!pergunta) return null;
      return { etapa: strOrNull(o['etapa']) ?? '', pergunta };
    })
    .filter((x): x is RoleplayModelQuestion => x !== null);
}

// ── helpers ─────────────────────────────────────────────────────────────────

function assertNota0a10(v: unknown, field: string): number {
  const num = Number(v);
  if (!Number.isFinite(num)) throw new Error(`Nota "${field}" não é número: ${String(v)}`);
  return Math.round(Math.max(0, Math.min(10, num)) * 10) / 10;
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function strOrEmpty(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
