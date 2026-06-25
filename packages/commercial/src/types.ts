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

// ──────────────── Role-play SPIN (treino comercial — roleplay-spin-v1) ───────
// A closer treina perguntas SPIN conversando com um "lead" simulado pela IA.
// O score é end-of-session (1 chamada unificada, igual à closer) e calculado
// no código a partir das nota_0_10 por critério que o modelo devolve.

export type RoleplayDifficulty = 'facil' | 'medio' | 'dificil';

// Cenário como DADO de entrada do motor (vem do DB, mas o motor é puro).
export interface RoleplayScenario {
  name: string;
  persona: string; // quem é o lead (idade, contexto, dor latente)
  context: string; // situação comercial (origem, momento da jornada)
  objections: string[]; // objeções/resistências realistas
  spinFocus: string[]; // ex: ["implicacao","necessidade"]
  difficulty: RoleplayDifficulty; // quão guardado é o lead
}

// Mensagem do histórico passado ao motor de turno (sem 'system').
export interface RoleplayMessage {
  role: 'prospect' | 'closer';
  content: string;
}

// Próxima fala do prospect (lead simulado).
export interface RoleplayTurnOutput {
  fala: string;
}

// 5 critérios SPIN, nota crua 0–10 (a nota global é ponderada no código).
export interface RoleplayScoreBreakdown {
  situacao: number; // S — mapeou contexto sem interrogatório
  problema: number; // P — fez o lead admitir insatisfação/dor
  implicacao: number; // I — fez o lead sentir o custo de não resolver
  necessidade: number; // N — fez o lead verbalizar o valor de resolver
  conducao_escuta: number; // não pitchou cedo, aprofundou follow-up
}

// Trecho literal da sessão (melhor momento).
export interface RoleplayEvidence {
  texto: string;
  trecho: string; // citação literal da sessão
}

// Pergunta fraca da closer + reescrita mais forte ("dê exemplos de como fazer").
export interface RoleplayQuestionRewrite {
  original: string;
  reescrita: string;
}

// Pergunta-modelo de implicação/necessidade que cabia no cenário.
export interface RoleplayModelQuestion {
  etapa: string; // ex: "implicacao", "necessidade"
  pergunta: string;
}

// Dossiê de feedback — gravado no jsonb feedback.
export interface RoleplayFeedbackDossier {
  leitura_1_linha: string;
  notas: RoleplayScoreBreakdown; // 0–10 por critério (cru do modelo)
  melhores_momentos: RoleplayEvidence[]; // 3, com trecho literal
  perguntas_fracas: RoleplayQuestionRewrite[]; // 3, original + reescrita
  perguntas_modelo: RoleplayModelQuestion[]; // 2 de implicação/necessidade
  proximo_foco: string; // 1 frase
}

// Resultado final da análise do treino.
export interface RoleplayAnalysisResult {
  overallScore: number; // 0–100 (sempre calculado no código)
  breakdown: RoleplayScoreBreakdown;
  feedback: RoleplayFeedbackDossier;
  summary: string; // = feedback.leitura_1_linha
  model: string;
}

export interface RunRoleplayAnalysisInput {
  scenario: RoleplayScenario;
  transcript: string; // sessão completa formatada (closer/prospect)
}

export interface RunRoleplayTurnInput {
  scenario: RoleplayScenario;
  history: RoleplayMessage[]; // turnos anteriores (closer/prospect)
}

// Rascunho de cenário extraído de uma transcrição — para revisão humana.
export interface RoleplayScenarioDraft {
  persona: string;
  context: string;
  objections: string[];
}
