// Tipos do motor de análise comercial — adaptados do CallScore (ba-hub),
// enxutos: sem tenant/opportunity/contact. Duas réguas: closer e SDR.

export type Analyzer = 'closer' | 'sdr';
export type AnalysisStatus = 'pendente' | 'processando' | 'concluido' | 'erro';
export type NivelInteresse = 'baixo' | 'medio' | 'alto';

// ───────────────── Closer (régua Winning by Design — closer-v2) ─────────────
// Avalia EXECUÇÃO DO MÉTODO comercial do Studio Sal (venda consultiva), não se
// a venda fechou. Call de fechamento OU diagnóstico/1ª call (transcrição Meet).

// Etapa detectada na call — define a tabela de pesos dos blocos.
export type CloserEtapa = 'fechamento' | 'diagnostico';

// Passo 1 do método: detecção antes de pontuar.
export interface CloserDetection {
  produto: string; // ex: "mentoria completa", "consultoria essencial", "indefinido"
  etapa: CloserEtapa;
  num_decisores: number; // 1 ou 2
  segundo_decisor_conduzido: boolean | null; // null quando num_decisores = 1
  lead_qualificado: boolean;
  lead_qualificado_obs: string | null; // contexto quando desqualificado
}

// 7 blocos A–G, nota crua de 0 a 10 (a nota global é ponderada no código).
export interface CloserBlockScores {
  abertura: number; // A — Abertura & conexão
  conducao: number; // B — Condução & controle
  diagnostico: number; // C — Diagnóstico (Situação + Dor)
  desejo: number; // D — Desejo / Impacto positivo
  implicacao: number; // E — Implicação / custo de não agir
  urgencia: number; // F — Critical Event / urgência
  fechamento: number; // G — Decisão & fechamento (ou conversão p/ próximo passo)
}

// Acerto/falha sempre acompanhado de trecho literal da transcrição.
export interface CloserEvidence {
  texto: string;
  trecho: string; // citação literal entre aspas, vinda da transcrição
}

// Recomendação acionável com script pronto pra usar na próxima call.
export interface CloserRecommendation {
  texto: string;
  script: string;
}

// Dossiê de método completo — gravado no jsonb score_breakdown.
export interface CloserMethodDossier {
  deteccao: CloserDetection;
  blocos: CloserBlockScores; // 0–10
  pesos: CloserBlockScores; // pesos aplicados (somam ~1), dependem da etapa
  leitura_1_linha: string;
  analise_desejo: string;
  analise_implicacao: string;
  acertos: CloserEvidence[]; // 3
  falhas: CloserEvidence[]; // 3
  sinais_vermelhos: string[]; // [] quando "nenhum grave"
  recomendacoes: CloserRecommendation[]; // 3
}

// Business intel extraído da call (alimenta lista e painel "dados extraídos").
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

// Resultado final da análise da closer (dossiê + extração combinados).
export interface CloserAnalysisResult {
  overallScore: number; // 0–100 normalizado (sempre calculado no código)
  dossier: CloserMethodDossier;
  summary: string; // = dossier.leitura_1_linha (vai pro score_summary)
  extracted: CloserExtractedData;
  model: string; // modelo real usado (ex: 'gpt-4o')
  compressed: boolean; // true se houve compressão extrativa de fallback
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
