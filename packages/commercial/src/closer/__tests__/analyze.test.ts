import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { computeCloserOverallScore, runCloserAnalysis } from '../analyze';
import * as openaiModule from '../../openai';

vi.mock('../../openai', () => ({ callGPT4oJSON: vi.fn() }));
const callGPT4oJSON = openaiModule.callGPT4oJSON as MockedFunction<typeof openaiModule.callGPT4oJSON>;

const MOCK_SCORE_RESPONSE = {
  overall_score: 85,
  breakdown: {
    escuta_ativa: 80,
    clareza: 75,
    tecnica_vendas: 70,
    conducao: 90,
    rapport: 95,
    fechamento: 92,
  },
  summary: 'Pontos fortes: rapport excelente e fechamento sólido. Melhoria: qualificação.',
};

const MOCK_EXTRACTION_RESPONSE = {
  fechou: true,
  dor_principal: 'Dificuldade em se posicionar nas redes sociais com autenticidade',
  dores_secundarias: ['Medo de exposição', 'Falta de clareza sobre identidade de marca'],
  programa_interesse: 'mentoria essencial',
  orcamento_mencionado: '12 de R$577,70',
  orcamento_valor: 6930,
  forma_pagamento: '12x no cartão',
  objecoes: ['Processo em grupo'],
  nivel_interesse: 'alto',
  proximos_passos: ['Enviar Pix de sinal de R$500', 'Preencher formulário de checkin'],
  concorrentes_mencionados: ['Agência anterior que engessava a cliente'],
  insights_adicionais: 'Psicóloga de 27 anos de experiência, querendo lançar curso online.',
};

describe('computeCloserOverallScore', () => {
  it('computes weighted score correctly (fechamento=30%, conducao=20%, tecnica=20%, rest=10%)', () => {
    // All 100 → 100
    expect(
      computeCloserOverallScore({
        escuta_ativa: 100,
        clareza: 100,
        tecnica_vendas: 100,
        conducao: 100,
        rapport: 100,
        fechamento: 100,
      }),
    ).toBe(100);

    // All 0 → 0
    expect(
      computeCloserOverallScore({
        escuta_ativa: 0,
        clareza: 0,
        tecnica_vendas: 0,
        conducao: 0,
        rapport: 0,
        fechamento: 0,
      }),
    ).toBe(0);

    // fechamento=100, rest=0 → 30
    expect(
      computeCloserOverallScore({
        escuta_ativa: 0,
        clareza: 0,
        tecnica_vendas: 0,
        conducao: 0,
        rapport: 0,
        fechamento: 100,
      }),
    ).toBe(30);

    // Manual: 80*0.1 + 75*0.1 + 70*0.2 + 90*0.2 + 95*0.1 + 92*0.3 = 8+7.5+14+18+9.5+27.6 = 84.6 → 85
    expect(
      computeCloserOverallScore({
        escuta_ativa: 80,
        clareza: 75,
        tecnica_vendas: 70,
        conducao: 90,
        rapport: 95,
        fechamento: 92,
      }),
    ).toBe(85);
  });

  it('clamps score to [0, 100]', () => {
    expect(
      computeCloserOverallScore({
        escuta_ativa: 200,
        clareza: 200,
        tecnica_vendas: 200,
        conducao: 200,
        rapport: 200,
        fechamento: 200,
      }),
    ).toBe(100);
  });
});

describe('runCloserAnalysis', () => {
  beforeEach(() => {
    callGPT4oJSON.mockReset();
  });

  it('calls callGPT4oJSON twice (score + extraction)', async () => {
    callGPT4oJSON
      .mockResolvedValueOnce(MOCK_SCORE_RESPONSE)
      .mockResolvedValueOnce(MOCK_EXTRACTION_RESPONSE);

    await runCloserAnalysis({ transcript: 'Renata Restaino: Olá. Beatriz: Olá.' });
    expect(callGPT4oJSON).toHaveBeenCalledTimes(2);
  });

  it('returns CloserAnalysisResult with correct shape', async () => {
    callGPT4oJSON
      .mockResolvedValueOnce(MOCK_SCORE_RESPONSE)
      .mockResolvedValueOnce(MOCK_EXTRACTION_RESPONSE);

    const result = await runCloserAnalysis({ transcript: 'Renata: Olá. Lead: Olá.' });

    expect(result.overallScore).toBe(85);
    expect(result.breakdown.fechamento).toBe(92);
    expect(result.breakdown.rapport).toBe(95);
    expect(result.summary).toContain('rapport');

    expect(result.extracted.fechou).toBe(true);
    expect(result.extracted.dor_principal).toContain('posicionar');
    expect(result.extracted.programa_interesse).toBe('mentoria essencial');
    expect(result.extracted.orcamento_valor).toBe(6930);
    expect(result.extracted.nivel_interesse).toBe('alto');
    expect(result.extracted.proximos_passos).toHaveLength(2);
  });

  it('overrides model overall_score with computed weighted score', async () => {
    // Model returns overall_score=99 (wrong), code should recompute
    callGPT4oJSON
      .mockResolvedValueOnce({ ...MOCK_SCORE_RESPONSE, overall_score: 99 })
      .mockResolvedValueOnce(MOCK_EXTRACTION_RESPONSE);

    const result = await runCloserAnalysis({ transcript: 'Texto qualquer.' });
    // Weighted calc: 80*0.1+75*0.1+70*0.2+90*0.2+95*0.1+92*0.3 = 84.6 → 85
    expect(result.overallScore).toBe(85);
  });

  it('throws on empty transcript', async () => {
    await expect(runCloserAnalysis({ transcript: '   ' })).rejects.toThrow('Transcrição vazia');
    expect(callGPT4oJSON).not.toHaveBeenCalled();
  });

  it('throws when score breakdown is missing', async () => {
    callGPT4oJSON.mockResolvedValueOnce({ overall_score: 80, summary: 'ok' }); // no breakdown

    await expect(runCloserAnalysis({ transcript: 'abc' })).rejects.toThrow('breakdown');
  });

  it('coerces non-finite breakdown fields', async () => {
    callGPT4oJSON
      .mockResolvedValueOnce({
        ...MOCK_SCORE_RESPONSE,
        breakdown: { ...MOCK_SCORE_RESPONSE.breakdown, escuta_ativa: 'not a number' },
      })
      .mockResolvedValueOnce(MOCK_EXTRACTION_RESPONSE);

    await expect(runCloserAnalysis({ transcript: 'abc' })).rejects.toThrow('escuta_ativa');
  });

  it('handles null extraction fields gracefully', async () => {
    callGPT4oJSON.mockResolvedValueOnce(MOCK_SCORE_RESPONSE).mockResolvedValueOnce({
      fechou: null,
      dor_principal: null,
      dores_secundarias: null,
      programa_interesse: null,
      orcamento_mencionado: null,
      orcamento_valor: null,
      forma_pagamento: null,
      objecoes: null,
      nivel_interesse: null,
      proximos_passos: null,
      concorrentes_mencionados: null,
      insights_adicionais: null,
    });

    const result = await runCloserAnalysis({ transcript: 'abc' });
    expect(result.extracted.fechou).toBeNull();
    expect(result.extracted.dor_principal).toBeNull();
    expect(result.extracted.nivel_interesse).toBeNull();
  });
});
