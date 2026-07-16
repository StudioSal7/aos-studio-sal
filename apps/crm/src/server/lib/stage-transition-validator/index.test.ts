import { describe, expect, it } from 'vitest';
import { validateStageTransition } from './index';

describe('validateStageTransition', () => {
  it('permite qualquer transição para estágio open sem restrições', () => {
    expect(validateStageTransition('open', 'under_review', {})).toEqual({ valid: true });
  });

  it('permite transição para won sem restrições (ex: closed_verbally)', () => {
    expect(validateStageTransition('won', 'closed_verbally', {})).toEqual({ valid: true });
  });

  it('bloqueia transição para lost sem motivo', () => {
    const result = validateStageTransition('lost', 'lost', {});
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toBe('motivo_perda_required');
  });

  it('permite transição para lost com motivo', () => {
    expect(
      validateStageTransition('lost', 'lost', { motivoPerdaId: 'uuid-motivo' }),
    ).toEqual({ valid: true });
  });

  it('bloqueia transição para paid sem valor', () => {
    const result = validateStageTransition('won', 'paid', {
      formaPagamentoNegociada: 'pix',
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toBe('valor_e_forma_required');
  });

  it('bloqueia transição para paid sem forma de pagamento', () => {
    const result = validateStageTransition('won', 'paid', {
      valorProposto: '5000',
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toBe('valor_e_forma_required');
  });

  it('bloqueia transição para paid sem produto vinculado', () => {
    const result = validateStageTransition('won', 'paid', {
      valorProposto: '5000',
      formaPagamentoNegociada: 'pix',
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toBe('produto_required');
  });

  it('permite transição para paid com valor, forma e produto', () => {
    expect(
      validateStageTransition('won', 'paid', {
        valorProposto: '5000',
        formaPagamentoNegociada: 'pix',
        produtoFechadoId: 'uuid-produto',
      }),
    ).toEqual({ valid: true });
  });

  it('bloqueia paid mesmo com stageKind=won se faltar dado', () => {
    const result = validateStageTransition('won', 'paid', {});
    expect(result.valid).toBe(false);
  });
});
