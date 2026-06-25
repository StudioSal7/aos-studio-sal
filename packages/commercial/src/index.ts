// @repo/commercial — motor de análise comercial (GPT-4o), puro e sem DB.
// As funções run*Analysis recebem texto + metadata e retornam avaliação
// estruturada; a persistência fica nas server actions / scripts do app.

export * from './types';
export { callGPT4oJSON, callGPT4oChat, OPENAI_MODEL, TruncatedResponseError } from './openai';
export type { CallGPTOptions, ChatMessage } from './openai';

// Closer habilitado na Fatia 2 (calibrado nas transcrições reais do Gemini/Meet):
export { runCloserAnalysis, computeCloserOverallScore, CLOSER_RUBRIC_VERSION } from './closer/analyze';
export { cleanGeminiTranscript } from './closer/transcript-cleaner';
// SDR habilitado na Fatia 5 (pull sob demanda via Evolution API):
export { runSdrAnalysis, computeSdrOverallScore, SDR_RUBRIC_VERSION } from './sdr/analyze';
// Treino comercial — role-play SPIN (lead simulado por IA):
export { runRoleplayTurn } from './roleplay/runRoleplayTurn';
export { runRoleplayAnalysis } from './roleplay/runRoleplayAnalysis';
export { scenarioFromTranscript } from './roleplay/scenarioFromTranscript';
export {
  computeRoleplayOverallScore,
  PESOS_ROLEPLAY,
  ROLEPLAY_RUBRIC_VERSION,
} from './roleplay/rubric';
