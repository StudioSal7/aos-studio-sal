import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { computeCloserOverallScore, pesosPorEtapa, runCloserAnalysis } from '../analyze';
import * as openaiModule from '../../openai';
import type { CloserBlockScores } from '../../types';

vi.mock('../../openai', async (importOriginal) => {
  const actual = await importOriginal<typeof openaiModule>();
  return { ...actual, callGPT4oJSON: vi.fn(), OPENAI_MODEL: 'gpt-4o' };
});
const callGPT4oJSON = openaiModule.callGPT4oJSON as MockedFunction<typeof openaiModule.callGPT4oJSON>;

const TENS: CloserBlockScores = {
  abertura: 10,
  conducao: 10,
  diagnostico: 10,
  desejo: 10,
  implicacao: 10,
  urgencia: 10,
  fechamento: 10,
};
const ZEROS: CloserBlockScores = {
  abertura: 0,
  conducao: 0,
  diagnostico: 0,
  desejo: 0,
  implicacao: 0,
  urgencia: 0,
  fechamento: 0,
};

const MOCK_DOSSIER = {
  deteccao: {
    produto: 'mentoria essencial',
    etapa: 'fechamento',
    num_decisores: 1,
    segundo_decisor_conduzido: null,
    lead_qualificado: true,
    lead_qualificado_obs: null,
  },
  blocos: {
    abertura: 8,
    conducao: 7,
    diagnostico: 9,
    desejo: 6,
    implicacao: 5,
    urgencia: 7,
    fechamento: 8,
  },
  leitura_1_linha: 'Boa conexão, mas implicação ficou rasa e deixou dinheiro na mesa.',
  analise_desejo: 'Desejo construído via cases, pouco aterrissado na cliente.',
  analise_implicacao: 'Implicação afirmada pelo closer, cliente não verbalizou o custo.',
  acertos: [
    { texto: 'Rapport forte na abertura', trecho: 'Que bom te ver, conta tudo' },
    { texto: 'Diagnóstico com perguntas abertas', trecho: 'O que mais te incomoda hoje?' },
    { texto: 'Reframe de objeção sem pressão', trecho: 'Faz sentido pensar com calma' },
  ],
  falhas: [
    { texto: 'Preço antes de ancorar valor', trecho: 'São 12 de 577' },
    { texto: 'Implicação não extraída', trecho: '(ausência na transcrição)' },
    { texto: 'Sem próximo passo com data', trecho: 'Depois a gente vê' },
  ],
  sinais_vermelhos: ['Desconto sem ancoragem prévia de valor'],
  recomendacoes: [
    { texto: 'Extrair a implicação', script: 'O que acontece se daqui a 1 ano nada mudar?' },
    { texto: 'Ancorar valor antes do preço', script: 'Antes do investimento, deixa eu te mostrar...' },
    { texto: 'Fechar com data', script: 'Te mando o contrato hoje, começamos segunda?' },
  ],
  extracao: {
    fechou: true,
    dor_principal: 'Dificuldade em se posicionar com autenticidade',
    dores_secundarias: ['Medo de exposição'],
    programa_interesse: 'mentoria essencial',
    orcamento_mencionado: '12 de R$577,70',
    orcamento_valor: 6930,
    forma_pagamento: '12x no cartão',
    objecoes: ['Processo em grupo'],
    nivel_interesse: 'alto',
    proximos_passos: ['Enviar contrato'],
    concorrentes_mencionados: ['Agência anterior'],
    insights_adicionais: 'Psicóloga, 27 anos de experiência.',
  },
};

describe('pesosPorEtapa', () => {
  it('soma 1 em ambas as etapas', () => {
    const sum = (p: CloserBlockScores) =>
      p.abertura + p.conducao + p.diagnostico + p.desejo + p.implicacao + p.urgencia + p.fechamento;
    expect(sum(pesosPorEtapa('fechamento'))).toBeCloseTo(1, 5);
    expect(sum(pesosPorEtapa('diagnostico'))).toBeCloseTo(1, 5);
  });

  it('tabelas diferentes por etapa (diagnóstico pesa mais diagnóstico)', () => {
    expect(pesosPorEtapa('diagnostico').diagnostico).toBeGreaterThan(
      pesosPorEtapa('fechamento').diagnostico,
    );
    expect(pesosPorEtapa('fechamento').implicacao).toBeGreaterThan(
      pesosPorEtapa('diagnostico').implicacao,
    );
  });
});

describe('computeCloserOverallScore', () => {
  it('tudo 10 → 100, tudo 0 → 0 (ambas etapas)', () => {
    expect(computeCloserOverallScore(TENS, 'fechamento')).toBe(100);
    expect(computeCloserOverallScore(TENS, 'diagnostico')).toBe(100);
    expect(computeCloserOverallScore(ZEROS, 'fechamento')).toBe(0);
  });

  it('aplica a tabela de pesos da etapa', () => {
    // fechamento=10, resto 0 → peso fechamento (0.20) × 10 × 10 = 20
    const onlyFechamento = { ...ZEROS, fechamento: 10 };
    expect(computeCloserOverallScore(onlyFechamento, 'fechamento')).toBe(20);
    // mesma config em diagnóstico: peso 0.15 → 15
    expect(computeCloserOverallScore(onlyFechamento, 'diagnostico')).toBe(15);
  });

  it('mesmos blocos rendem nota diferente conforme a etapa', () => {
    const blocos = MOCK_DOSSIER.blocos as CloserBlockScores;
    const f = computeCloserOverallScore(blocos, 'fechamento');
    const d = computeCloserOverallScore(blocos, 'diagnostico');
    expect(f).not.toBe(d);
  });

  it('clampa para [0, 100]', () => {
    const over = { ...TENS, fechamento: 50 };
    expect(computeCloserOverallScore(over, 'fechamento')).toBe(100);
  });
});

describe('runCloserAnalysis', () => {
  beforeEach(() => {
    callGPT4oJSON.mockReset();
  });

  it('faz 1 chamada gpt-4o (dossiê + extração unificados)', async () => {
    callGPT4oJSON.mockResolvedValueOnce(MOCK_DOSSIER);
    await runCloserAnalysis({ transcript: 'Renata Restaino: Olá. Beatriz: Olá.' });
    expect(callGPT4oJSON).toHaveBeenCalledTimes(1);
  });

  it('retorna CloserAnalysisResult com shape correto', async () => {
    callGPT4oJSON.mockResolvedValueOnce(MOCK_DOSSIER);
    const result = await runCloserAnalysis({ transcript: 'Renata: Olá. Lead: Olá.' });

    // overall = computado no código a partir dos blocos + etapa fechamento
    expect(result.overallScore).toBe(
      computeCloserOverallScore(MOCK_DOSSIER.blocos as CloserBlockScores, 'fechamento'),
    );
    expect(result.dossier.deteccao.etapa).toBe('fechamento');
    expect(result.dossier.blocos.implicacao).toBe(5);
    expect(result.dossier.pesos.implicacao).toBe(pesosPorEtapa('fechamento').implicacao);
    expect(result.dossier.acertos).toHaveLength(3);
    expect(result.dossier.acertos[0]?.trecho).toContain('conta tudo');
    expect(result.dossier.falhas).toHaveLength(3);
    expect(result.dossier.recomendacoes[0]?.script).toContain('1 ano');
    expect(result.dossier.sinais_vermelhos).toHaveLength(1);
    expect(result.summary).toBe(MOCK_DOSSIER.leitura_1_linha);
    expect(result.model).toBe('gpt-4o');
    expect(result.compressed).toBe(false);

    // extração de negócio preservada
    expect(result.extracted.fechou).toBe(true);
    expect(result.extracted.orcamento_valor).toBe(6930);
    expect(result.extracted.nivel_interesse).toBe('alto');
  });

  it('detecta etapa diagnostico e pondera de acordo', async () => {
    callGPT4oJSON.mockResolvedValueOnce({
      ...MOCK_DOSSIER,
      deteccao: { ...MOCK_DOSSIER.deteccao, etapa: 'diagnostico' },
    });
    const result = await runCloserAnalysis({ transcript: 'abc' });
    expect(result.dossier.deteccao.etapa).toBe('diagnostico');
    expect(result.dossier.pesos.diagnostico).toBe(pesosPorEtapa('diagnostico').diagnostico);
    expect(result.overallScore).toBe(
      computeCloserOverallScore(MOCK_DOSSIER.blocos as CloserBlockScores, 'diagnostico'),
    );
  });

  it('lança em transcrição vazia', async () => {
    await expect(runCloserAnalysis({ transcript: '   ' })).rejects.toThrow('Transcrição vazia');
    expect(callGPT4oJSON).not.toHaveBeenCalled();
  });

  it('lança quando blocos ausentes', async () => {
    callGPT4oJSON.mockResolvedValueOnce({ deteccao: MOCK_DOSSIER.deteccao, leitura_1_linha: 'x' });
    await expect(runCloserAnalysis({ transcript: 'abc' })).rejects.toThrow('blocos');
  });

  it('lança quando um bloco não é número', async () => {
    callGPT4oJSON.mockResolvedValueOnce({
      ...MOCK_DOSSIER,
      blocos: { ...MOCK_DOSSIER.blocos, desejo: 'não é número' },
    });
    await expect(runCloserAnalysis({ transcript: 'abc' })).rejects.toThrow('desejo');
  });

  it('trata extração nula sem quebrar', async () => {
    callGPT4oJSON.mockResolvedValueOnce({
      ...MOCK_DOSSIER,
      extracao: {
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
      },
    });
    const result = await runCloserAnalysis({ transcript: 'abc' });
    expect(result.extracted.fechou).toBeNull();
    expect(result.extracted.dor_principal).toBeNull();
    expect(result.extracted.nivel_interesse).toBeNull();
  });
});
