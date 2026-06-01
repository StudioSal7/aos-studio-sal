// Tipos do motor de análise comercial — adaptados do CallScore (ba-hub),
// enxutos: sem tenant/opportunity/contact. Duas réguas: closer e SDR.

export type Analyzer = 'closer' | 'sdr';
export type AnalysisStatus = 'pendente' | 'processando' | 'concluido' | 'erro';
export type NivelInteresse = 'baixo' | 'medio' | 'alto';

// ─────────────────────────── Closer (6 critérios) ───────────────────────────
// Call de fechamento de mentoria/branding remoto (transcrição do Google Meet).

export interface CloserScoreBreakdown {
  escuta_ativa: number;
  clareza: number;
  tecnica_vendas: number;
  conducao: number;
  rapport: number;
  fechamento: number;
}

export interface CloserExtractedData {
  fechou: boolean | null;
  dor_principal: string | null;
  dores_secundarias: string[] | null;
  programa_interesse: string | null; // ex: "mentoria essencial", "consultoria completa"
  orcamento_mencionado: string | null;
  orcamento_valor: number | null;
  forma_pagamento: string | null;
  objecoes: string[] | null;
  nivel_interesse: NivelInteresse | null;
  proximos_passos: string[] | null;
  concorrentes_mencionados: string[] | null;
  insights_adicionais: string | null;
}

// Resposta crua do GPT-4o (scoring da closer).
export interface CloserScoreResponse {
  overall_score: number;
  breakdown: CloserScoreBreakdown;
  summary: string;
}

// Resultado final da análise da closer (score + extração combinados).
export interface CloserAnalysisResult {
  overallScore: number;
  breakdown: CloserScoreBreakdown;
  summary: string;
  extracted: CloserExtractedData;
}

export interface RunCloserAnalysisInput {
  transcript: string;
}

// ──────────────────────────────── SDR (5 critérios) ─────────────────────────
// Thread de WhatsApp de pré-venda (qualificação + condução ao agendamento).
// `velocidade_resposta` é null quando a thread não tem timestamps por mensagem
// (degradação graciosa — nunca uma nota fabricada; excluído do overall ponderado).

export interface SdrScoreBreakdown {
  velocidade_resposta: number | null;
  qualificacao: number;
  clareza: number;
  conducao_agendamento: number;
  rapport: number;
}

export interface SdrExtractedData {
  agendou: boolean | null;
  data_agendamento: string | null;
  nivel_interesse: NivelInteresse | null;
  faixa_renda: string | null;
  tempo_no_nicho: string | null;
  objecoes: string[] | null;
  proximos_passos: string[] | null;
  insights_adicionais: string | null;
}

export interface SdrScoreResponse {
  aplicavel: boolean;
  motivo_nao_aplicavel: string | null;
  overall_score: number;
  breakdown: SdrScoreBreakdown;
  summary: string;
}

export interface SdrAnalysisResult {
  // false quando a conversa não é de pré-venda SDR (contato frio, recado interno, etc.).
  applicable: boolean;
  applicabilityReason: string | null;
  overallScore: number;
  breakdown: SdrScoreBreakdown;
  summary: string;
  extracted: SdrExtractedData;
}

export interface RunSdrAnalysisInput {
  thread: string;
}
