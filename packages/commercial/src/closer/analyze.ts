import { callGPT4oJSON, OPENAI_MODEL } from '../openai';
import type {
  CloserAnalysisResult,
  CloserBlockScores,
  CloserDetection,
  CloserEtapa,
  CloserEvidence,
  CloserExtractedData,
  CloserMethodDossier,
  CloserRecommendation,
  NivelInteresse,
  RunCloserAnalysisInput,
} from '../types';
import { compressTranscript } from './compress';
import { buildCloserScoringSystemPrompt, buildCloserScoringUserPrompt } from './prompts';
import { cleanGeminiTranscript, estimateTokens } from './transcript-cleaner';

// Versão da régua da closer (Winning by Design — critérios + pesos + prompt).
export const CLOSER_RUBRIC_VERSION = 'closer-v2';

// Teto de tokens da transcrição enviada ao gpt-4o. A OpenAI reserva
// prompt + max_tokens contra o TPM; com 30k TPM (Tier 1), prompt (~2,5k) e
// max_tokens (4096) reservados, sobra ~23k → teto conservador de 22k.
// Ajustável por env caso o tier mude (ver Etapa 0.1 do plano).
const TRANSCRIPT_CEILING = Number(process.env.CLOSER_TRANSCRIPT_CEILING ?? 22000);

// Folga generosa pro dossiê (JSON grande); guarda de truncamento em openai.ts.
const MAX_OUTPUT_TOKENS = 4096;

// Pesos por etapa (somam 1). Aplicados no código — não confiamos na aritmética do modelo.
const PESOS_FECHAMENTO: CloserBlockScores = {
  abertura: 0.1,
  conducao: 0.075,
  diagnostico: 0.15,
  desejo: 0.2,
  implicacao: 0.2,
  urgencia: 0.075,
  fechamento: 0.2,
};
const PESOS_DIAGNOSTICO: CloserBlockScores = {
  abertura: 0.1,
  conducao: 0.1,
  diagnostico: 0.25,
  desejo: 0.15,
  implicacao: 0.15,
  urgencia: 0.1,
  fechamento: 0.15,
};

export function pesosPorEtapa(etapa: CloserEtapa): CloserBlockScores {
  return etapa === 'diagnostico' ? PESOS_DIAGNOSTICO : PESOS_FECHAMENTO;
}

/**
 * Nota global 0–100 a partir dos blocos 0–10 e da etapa.
 * Soma ponderada (0–10) × 10 → 0–100, arredondada e clampada.
 */
export function computeCloserOverallScore(
  blocos: CloserBlockScores,
  etapa: CloserEtapa,
): number {
  const pesos = pesosPorEtapa(etapa);
  const raw10 =
    blocos.abertura * pesos.abertura +
    blocos.conducao * pesos.conducao +
    blocos.diagnostico * pesos.diagnostico +
    blocos.desejo * pesos.desejo +
    blocos.implicacao * pesos.implicacao +
    blocos.urgencia * pesos.urgencia +
    blocos.fechamento * pesos.fechamento;
  return Math.round(Math.max(0, Math.min(100, raw10 * 10)));
}

/**
 * Analisa uma transcrição de call da Studio Sal pela régua Winning by Design.
 *
 * Função pura — não toca o banco. Limpa a transcrição (determinístico),
 * comprime extrativamente se exceder o teto, faz 1 chamada gpt-4o (dossiê +
 * extração) e retorna o resultado estruturado. Persistência fica na action/script.
 */
export async function runCloserAnalysis(
  input: RunCloserAnalysisInput,
): Promise<CloserAnalysisResult> {
  const { transcript } = input;
  if (!transcript.trim()) throw new Error('Transcrição vazia');

  // 1) Limpeza determinística (custo zero, preserva falas).
  const { cleaned } = cleanGeminiTranscript(transcript);
  const base = cleaned.trim() ? cleaned : transcript.trim();

  // 2) Compressão extrativa só se ainda exceder o teto.
  let compressed = false;
  let prepared = base;
  if (estimateTokens(base) > TRANSCRIPT_CEILING) {
    const r = await compressTranscript(base, TRANSCRIPT_CEILING);
    prepared = r.transcript;
    compressed = r.compressed;
  }

  // 3) Uma chamada gpt-4o → dossiê + extração.
  const raw = await callGPT4oJSON(
    buildCloserScoringSystemPrompt(),
    buildCloserScoringUserPrompt(prepared),
    { maxTokens: MAX_OUTPUT_TOKENS },
  );

  const { dossier, extracted } = parseDossierResponse(raw);
  const overallScore = computeCloserOverallScore(dossier.blocos, dossier.deteccao.etapa);

  return {
    overallScore,
    dossier,
    summary: dossier.leitura_1_linha,
    extracted,
    model: OPENAI_MODEL,
    compressed,
  };
}

// ── parsing ───────────────────────────────────────────────────────────────

function parseDossierResponse(raw: unknown): {
  dossier: CloserMethodDossier;
  extracted: CloserExtractedData;
} {
  if (!raw || typeof raw !== 'object') throw new Error('Resposta não é um objeto');
  const r = raw as Record<string, unknown>;

  const deteccao = parseDetection(r['deteccao']);

  const bd = r['blocos'];
  if (!bd || typeof bd !== 'object') throw new Error('blocos ausente na resposta');
  const b = bd as Record<string, unknown>;
  const blocos: CloserBlockScores = {
    abertura: assertBlock(b['abertura'], 'abertura'),
    conducao: assertBlock(b['conducao'], 'conducao'),
    diagnostico: assertBlock(b['diagnostico'], 'diagnostico'),
    desejo: assertBlock(b['desejo'], 'desejo'),
    implicacao: assertBlock(b['implicacao'], 'implicacao'),
    urgencia: assertBlock(b['urgencia'], 'urgencia'),
    fechamento: assertBlock(b['fechamento'], 'fechamento'),
  };

  const dossier: CloserMethodDossier = {
    deteccao,
    blocos,
    pesos: pesosPorEtapa(deteccao.etapa),
    leitura_1_linha: strOrEmpty(r['leitura_1_linha']),
    analise_desejo: strOrEmpty(r['analise_desejo']),
    analise_implicacao: strOrEmpty(r['analise_implicacao']),
    acertos: parseEvidences(r['acertos']),
    falhas: parseEvidences(r['falhas']),
    sinais_vermelhos: strArrayOrEmpty(r['sinais_vermelhos']),
    recomendacoes: parseRecommendations(r['recomendacoes']),
  };

  const extracted = parseExtraction(r['extracao']);

  return { dossier, extracted };
}

function parseDetection(v: unknown): CloserDetection {
  const d = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const etapa: CloserEtapa = d['etapa'] === 'diagnostico' ? 'diagnostico' : 'fechamento';
  const num = Number(d['num_decisores']);
  const numDecisores = num === 2 ? 2 : 1;
  return {
    produto: strOrNull(d['produto']) ?? 'indefinido',
    etapa,
    num_decisores: numDecisores,
    segundo_decisor_conduzido:
      numDecisores === 2
        ? typeof d['segundo_decisor_conduzido'] === 'boolean'
          ? (d['segundo_decisor_conduzido'] as boolean)
          : false
        : null,
    lead_qualificado: d['lead_qualificado'] === false ? false : Boolean(d['lead_qualificado']),
    lead_qualificado_obs: strOrNull(d['lead_qualificado_obs']),
  };
}

function parseEvidences(v: unknown): CloserEvidence[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const texto = strOrNull(o['texto']);
      if (!texto) return null;
      return { texto, trecho: strOrNull(o['trecho']) ?? '' };
    })
    .filter((x): x is CloserEvidence => x !== null);
}

function parseRecommendations(v: unknown): CloserRecommendation[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const texto = strOrNull(o['texto']);
      if (!texto) return null;
      return { texto, script: strOrNull(o['script']) ?? '' };
    })
    .filter((x): x is CloserRecommendation => x !== null);
}

function parseExtraction(v: unknown): CloserExtractedData {
  const r = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    fechou: typeof r['fechou'] === 'boolean' ? (r['fechou'] as boolean) : null,
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

// ── helpers ─────────────────────────────────────────────────────────────────

function assertBlock(v: unknown, field: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Bloco "${field}" não é número: ${String(v)}`);
  return Math.round(Math.max(0, Math.min(10, n)) * 10) / 10;
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function strOrEmpty(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
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

function strArrayOrEmpty(v: unknown): string[] {
  return strArrayOrNull(v) ?? [];
}

function parseNivelInteresse(v: unknown): NivelInteresse | null {
  if (v === 'baixo' || v === 'medio' || v === 'alto') return v;
  return null;
}
