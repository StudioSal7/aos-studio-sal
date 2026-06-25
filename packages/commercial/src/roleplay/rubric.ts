import type { RoleplayScoreBreakdown } from '../types';

// Versão da régua de treino role-play SPIN (critérios + pesos + prompt).
export const ROLEPLAY_RUBRIC_VERSION = 'roleplay-spin-v1';

// Pesos por critério (somam 1). Aplicados no código — não confiamos na
// aritmética do modelo. Implicação e Necessidade concentram o peso: é onde a
// venda consultiva ganha ou perde (espelha a ênfase desejo/implicação da closer).
export const PESOS_ROLEPLAY: RoleplayScoreBreakdown = {
  situacao: 0.1, // 10%
  problema: 0.15, // 15%
  implicacao: 0.3, // 30%
  necessidade: 0.3, // 30%
  conducao_escuta: 0.15, // 15%
};

/**
 * Nota global 0–100 a partir das notas 0–10 por critério.
 * Soma ponderada (0–10) × 10 → 0–100, arredondada e clampada.
 */
export function computeRoleplayOverallScore(b: RoleplayScoreBreakdown): number {
  const raw10 =
    b.situacao * PESOS_ROLEPLAY.situacao +
    b.problema * PESOS_ROLEPLAY.problema +
    b.implicacao * PESOS_ROLEPLAY.implicacao +
    b.necessidade * PESOS_ROLEPLAY.necessidade +
    b.conducao_escuta * PESOS_ROLEPLAY.conducao_escuta;
  return Math.round(Math.max(0, Math.min(100, raw10 * 10)));
}
