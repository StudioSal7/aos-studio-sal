import { callGPT4oJSON } from '../openai';
import type { RoleplayScenarioDraft } from '../types';
import { cleanGeminiTranscript, estimateTokens } from '../closer/transcript-cleaner';
import { compressTranscript } from '../closer/compress';
import {
  buildScenarioFromTranscriptSystemPrompt,
  buildScenarioFromTranscriptUserPrompt,
} from './prompts';

// Mesmo teto da closer — reservas de TPM contra prompt + output.
const TRANSCRIPT_CEILING = Number(process.env.CLOSER_TRANSCRIPT_CEILING ?? 22000);
const MAX_OUTPUT_TOKENS = 1024;

/**
 * Extrai um rascunho de cenário ({persona, context, objections}) de uma
 * transcrição real, para REVISÃO HUMANA antes de salvar. Função pura.
 * Reusa a limpeza/compressão determinística da closer para textos longos.
 */
export async function scenarioFromTranscript(
  transcriptText: string,
): Promise<RoleplayScenarioDraft> {
  if (!transcriptText.trim()) throw new Error('Transcrição vazia');

  const { cleaned } = cleanGeminiTranscript(transcriptText);
  const base = cleaned.trim() ? cleaned : transcriptText.trim();

  let prepared = base;
  if (estimateTokens(base) > TRANSCRIPT_CEILING) {
    const r = await compressTranscript(base, TRANSCRIPT_CEILING);
    prepared = r.transcript;
  }

  const raw = await callGPT4oJSON(
    buildScenarioFromTranscriptSystemPrompt(),
    buildScenarioFromTranscriptUserPrompt(prepared),
    { maxTokens: MAX_OUTPUT_TOKENS },
  );

  return parseScenarioDraft(raw);
}

function parseScenarioDraft(raw: unknown): RoleplayScenarioDraft {
  if (!raw || typeof raw !== 'object') throw new Error('Resposta não é um objeto');
  const r = raw as Record<string, unknown>;
  return {
    persona: strOrEmpty(r['persona']),
    context: strOrEmpty(r['context']),
    objections: strArrayOrEmpty(r['objections']),
  };
}

function strOrEmpty(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strArrayOrEmpty(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim());
}
