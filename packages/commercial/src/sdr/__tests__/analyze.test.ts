import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { computeSdrOverallScore, runSdrAnalysis } from '../analyze';
import * as openaiModule from '../../openai';

vi.mock('../../openai', () => ({ callGPT4oJSON: vi.fn() }));
const callGPT4oJSON = openaiModule.callGPT4oJSON as MockedFunction<typeof openaiModule.callGPT4oJSON>;

const MOCK_SCORE_RESPONSE = {
  overall_score: 80,
  breakdown: {
    velocidade_resposta: 70,
    qualificacao: 80,
    clareza: 85,
    conducao_agendamento: 90,
    rapport: 75,
  },
  summary: 'Pontos fortes: condução ao agendamento. Melhoria: qualificação de renda.',
};

const MOCK_EXTRACTION_RESPONSE = {
  agendou: true,
  data_agendamento: 'quarta-feira, 28/05 às 15h',
  nivel_interesse: 'alto',
  faixa_renda: 'fatura cerca de 20k/mês',
  tempo_no_nicho: '6 anos como nutricionista',
  objecoes: ['preciso ver minha agenda'],
  proximos_passos: ['enviar link da call'],
  insights_adicionais: 'Lead muito engajada, respondeu rápido.',
};

describe('computeSdrOverallScore', () => {
  it('pondera corretamente com velocidade_resposta presente (conducao=30%, qualif=25%, rapport=20%, clareza=15%, vel=10%)', () => {
    // Todos 100 → 100
    expect(
      computeSdrOverallScore({
        velocidade_resposta: 100,
        qualificacao: 100,
        clareza: 100,
        conducao_agendamento: 100,
        rapport: 100,
      }),
    ).toBe(100);

    // conducao_agendamento=100, resto=0 → 30
    expect(
      computeSdrOverallScore({
        velocidade_resposta: 0,
        qualificacao: 0,
        clareza: 0,
        conducao_agendamento: 100,
        rapport: 0,
      }),
    ).toBe(30);

    // Manual: 70*.10 + 80*.25 + 85*.15 + 90*.30 + 75*.20 = 7+20+12.75+27+15 = 81.75 → 82
    expect(
      computeSdrOverallScore({
        velocidade_resposta: 70,
        qualificacao: 80,
        clareza: 85,
        conducao_agendamento: 90,
        rapport: 75,
      }),
    ).toBe(82);
  });

  it('renormaliza os pesos quando velocidade_resposta é null', () => {
    // Pesos restantes somam 0.9; renormalizados sobre 0.9.
    // conducao=100, resto=0 → 0.30/0.90 = 33.33 → 33
    expect(
      computeSdrOverallScore({
        velocidade_resposta: null,
        qualificacao: 0,
        clareza: 0,
        conducao_agendamento: 100,
        rapport: 0,
      }),
    ).toBe(33);

    // Todos os 4 disponíveis = 100 → 100 (independente do peso da velocidade)
    expect(
      computeSdrOverallScore({
        velocidade_resposta: null,
        qualificacao: 100,
        clareza: 100,
        conducao_agendamento: 100,
        rapport: 100,
      }),
    ).toBe(100);
  });

  it('clampa para [0, 100]', () => {
    expect(
      computeSdrOverallScore({
        velocidade_resposta: 200,
        qualificacao: 200,
        clareza: 200,
        conducao_agendamento: 200,
        rapport: 200,
      }),
    ).toBe(100);
  });
});

describe('runSdrAnalysis', () => {
  beforeEach(() => {
    callGPT4oJSON.mockReset();
  });

  it('chama callGPT4oJSON duas vezes (score + extração)', async () => {
    callGPT4oJSON
      .mockResolvedValueOnce(MOCK_SCORE_RESPONSE)
      .mockResolvedValueOnce(MOCK_EXTRACTION_RESPONSE);

    await runSdrAnalysis({ thread: '[01/01 10:00] SDR: oi\n[01/01 10:05] Lead: olá' });
    expect(callGPT4oJSON).toHaveBeenCalledTimes(2);
  });

  it('retorna SdrAnalysisResult com shape correto', async () => {
    callGPT4oJSON
      .mockResolvedValueOnce(MOCK_SCORE_RESPONSE)
      .mockResolvedValueOnce(MOCK_EXTRACTION_RESPONSE);

    const result = await runSdrAnalysis({ thread: 'conversa' });

    expect(result.overallScore).toBe(82);
    expect(result.breakdown.conducao_agendamento).toBe(90);
    expect(result.breakdown.velocidade_resposta).toBe(70);
    expect(result.summary).toContain('agendamento');

    expect(result.extracted.agendou).toBe(true);
    expect(result.extracted.nivel_interesse).toBe('alto');
    expect(result.extracted.proximos_passos).toHaveLength(1);
  });

  it('sobrescreve o overall_score do modelo com o cálculo ponderado', async () => {
    callGPT4oJSON
      .mockResolvedValueOnce({ ...MOCK_SCORE_RESPONSE, overall_score: 5 })
      .mockResolvedValueOnce(MOCK_EXTRACTION_RESPONSE);

    const result = await runSdrAnalysis({ thread: 'x' });
    expect(result.overallScore).toBe(82);
  });

  it('trata velocidade_resposta null vinda do modelo', async () => {
    callGPT4oJSON
      .mockResolvedValueOnce({
        ...MOCK_SCORE_RESPONSE,
        breakdown: { ...MOCK_SCORE_RESPONSE.breakdown, velocidade_resposta: null },
      })
      .mockResolvedValueOnce(MOCK_EXTRACTION_RESPONSE);

    const result = await runSdrAnalysis({ thread: 'x' });
    expect(result.breakdown.velocidade_resposta).toBeNull();
    // 80*.25 + 85*.15 + 90*.30 + 75*.20 = 20+12.75+27+15 = 74.75; /0.90 = 83.06 → 83
    expect(result.overallScore).toBe(83);
  });

  it('lança erro com thread vazia', async () => {
    await expect(runSdrAnalysis({ thread: '   ' })).rejects.toThrow('Thread vazia');
    expect(callGPT4oJSON).not.toHaveBeenCalled();
  });

  it('lança erro quando breakdown ausente', async () => {
    callGPT4oJSON.mockResolvedValueOnce({ overall_score: 80, summary: 'ok' });
    await expect(runSdrAnalysis({ thread: 'x' })).rejects.toThrow('breakdown');
  });

  it('marca applicable=false e propaga o motivo quando não é thread de SDR', async () => {
    callGPT4oJSON
      .mockResolvedValueOnce({
        ...MOCK_SCORE_RESPONSE,
        aplicavel: false,
        motivo_nao_aplicavel: 'Contato frio de divulgação, não há lead sendo qualificado.',
      })
      .mockResolvedValueOnce(MOCK_EXTRACTION_RESPONSE);

    const result = await runSdrAnalysis({ thread: 'x' });
    expect(result.applicable).toBe(false);
    expect(result.applicabilityReason).toContain('Contato frio');
  });

  it('applicable=true por padrão quando o modelo omite o campo', async () => {
    callGPT4oJSON
      .mockResolvedValueOnce(MOCK_SCORE_RESPONSE) // sem campo aplicavel
      .mockResolvedValueOnce(MOCK_EXTRACTION_RESPONSE);

    const result = await runSdrAnalysis({ thread: 'x' });
    expect(result.applicable).toBe(true);
    expect(result.applicabilityReason).toBeNull();
  });

  it('trata campos de extração null sem quebrar', async () => {
    callGPT4oJSON.mockResolvedValueOnce(MOCK_SCORE_RESPONSE).mockResolvedValueOnce({
      agendou: null,
      data_agendamento: null,
      nivel_interesse: null,
      faixa_renda: null,
      tempo_no_nicho: null,
      objecoes: null,
      proximos_passos: null,
      insights_adicionais: null,
    });

    const result = await runSdrAnalysis({ thread: 'x' });
    expect(result.extracted.agendou).toBeNull();
    expect(result.extracted.nivel_interesse).toBeNull();
    expect(result.extracted.objecoes).toBeNull();
  });
});
