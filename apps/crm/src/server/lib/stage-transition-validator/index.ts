/**
 * Validates whether a lead can transition to a given stage.
 *
 * Transitions are any-to-any by default. The only hard rules are:
 *   - Transitioning to a stage of kind='lost' requires a loss reason.
 *   - Transitioning to a stage with slug='paid' requires valor_proposto and forma_pagamento.
 *
 * The caller provides stageKind for the target stage and any extra fields being set
 * as part of the move. Validation is pure (no I/O).
 */

export type StageKind = 'open' | 'won' | 'lost';

export type TransitionExtras = {
  motivoPerdaId?: string | null;
  valorProposto?: string | null;
  formaPagamentoNegociada?: string | null;
};

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: 'motivo_perda_required' | 'valor_e_forma_required' };

export function validateStageTransition(
  targetStageKind: StageKind,
  targetStageSlug: string,
  extras: TransitionExtras,
): ValidationResult {
  if (targetStageKind === 'lost' && !extras.motivoPerdaId) {
    return { valid: false, reason: 'motivo_perda_required' };
  }

  if (targetStageSlug === 'paid') {
    const hasValor = Boolean(extras.valorProposto?.trim());
    const hasForma = Boolean(extras.formaPagamentoNegociada?.trim());
    if (!hasValor || !hasForma) {
      return { valid: false, reason: 'valor_e_forma_required' };
    }
  }

  return { valid: true };
}
