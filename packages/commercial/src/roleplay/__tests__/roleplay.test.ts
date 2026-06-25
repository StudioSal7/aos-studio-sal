import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { computeRoleplayOverallScore, PESOS_ROLEPLAY } from '../rubric';
import { runRoleplayAnalysis } from '../runRoleplayAnalysis';
import { runRoleplayTurn } from '../runRoleplayTurn';
import * as openaiModule from '../../openai';
import type { RoleplayScenario, RoleplayScoreBreakdown } from '../../types';

vi.mock('../../openai', async (importOriginal) => {
  const actual = await importOriginal<typeof openaiModule>();
  return {
    ...actual,
    callGPT4oJSON: vi.fn(),
    callGPT4oChat: vi.fn(),
    OPENAI_MODEL: 'gpt-4o',
  };
});
const callGPT4oJSON = openaiModule.callGPT4oJSON as MockedFunction<typeof openaiModule.callGPT4oJSON>;
const callGPT4oChat = openaiModule.callGPT4oChat as MockedFunction<typeof openaiModule.callGPT4oChat>;

const TENS: RoleplayScoreBreakdown = {
  situacao: 10,
  problema: 10,
  implicacao: 10,
  necessidade: 10,
  conducao_escuta: 10,
};
const ZEROS: RoleplayScoreBreakdown = {
  situacao: 0,
  problema: 0,
  implicacao: 0,
  necessidade: 0,
  conducao_escuta: 0,
};

const SCENARIO: RoleplayScenario = {
  name: 'Lead reservada',
  persona: 'Profissional autônoma, 34 anos, insegura sobre se posicionar.',
  context: 'Veio de indicação, ainda avaliando se vale investir.',
  objections: ['Preço', 'Falta de tempo'],
  spinFocus: ['implicacao', 'necessidade'],
  difficulty: 'medio',
};

const MOCK_FEEDBACK = {
  leitura_1_linha: 'Boas perguntas de situação, mas implicação ficou rasa.',
  notas: {
    situacao: 8,
    problema: 7,
    implicacao: 4,
    necessidade: 5,
    conducao_escuta: 6,
  },
  melhores_momentos: [
    { texto: 'Boa pergunta de situação', trecho: 'Como funciona seu dia hoje?' },
    { texto: 'Escuta ativa', trecho: 'Entendi, e isso te incomoda como?' },
    { texto: 'Follow-up', trecho: 'Conta mais sobre isso' },
  ],
  perguntas_fracas: [
    { original: 'Você quer fechar?', reescrita: 'O que precisaria acontecer pra valer a pena pra você?' },
    { original: 'É caro?', reescrita: 'Comparado a continuar como está, como você enxerga esse investimento?' },
    { original: 'Tem tempo?', reescrita: 'Quanto te custa hoje não ter isso resolvido?' },
  ],
  perguntas_modelo: [
    { etapa: 'implicacao', pergunta: 'Se daqui a um ano nada mudar, o que acontece com você?' },
    { etapa: 'necessidade', pergunta: 'O que mudaria pra você se isso estivesse resolvido?' },
  ],
  proximo_foco: 'Treinar perguntas de implicação que ampliam o custo da inação.',
};

describe('computeRoleplayOverallScore', () => {
  it('pesos somam 1', () => {
    const sum =
      PESOS_ROLEPLAY.situacao +
      PESOS_ROLEPLAY.problema +
      PESOS_ROLEPLAY.implicacao +
      PESOS_ROLEPLAY.necessidade +
      PESOS_ROLEPLAY.conducao_escuta;
    expect(sum).toBeCloseTo(1, 5);
  });

  it('tudo 10 → 100, tudo 0 → 0', () => {
    expect(computeRoleplayOverallScore(TENS)).toBe(100);
    expect(computeRoleplayOverallScore(ZEROS)).toBe(0);
  });

  it('aplica os pesos (implicação=10, resto 0 → 30)', () => {
    expect(computeRoleplayOverallScore({ ...ZEROS, implicacao: 10 })).toBe(30);
    expect(computeRoleplayOverallScore({ ...ZEROS, necessidade: 10 })).toBe(30);
    expect(computeRoleplayOverallScore({ ...ZEROS, situacao: 10 })).toBe(10);
  });

  it('clampa para [0, 100]', () => {
    expect(computeRoleplayOverallScore({ ...TENS, implicacao: 50 })).toBe(100);
  });
});

describe('runRoleplayAnalysis', () => {
  beforeEach(() => {
    callGPT4oJSON.mockReset();
  });

  it('faz 1 chamada gpt-4o (notas + dossiê unificados)', async () => {
    callGPT4oJSON.mockResolvedValueOnce(MOCK_FEEDBACK);
    await runRoleplayAnalysis({ scenario: SCENARIO, transcript: 'Closer: Oi. Lead: Oi.' });
    expect(callGPT4oJSON).toHaveBeenCalledTimes(1);
  });

  it('retorna shape correto e score calculado no código', async () => {
    callGPT4oJSON.mockResolvedValueOnce(MOCK_FEEDBACK);
    const result = await runRoleplayAnalysis({ scenario: SCENARIO, transcript: 'Closer: Oi. Lead: Oi.' });

    expect(result.overallScore).toBe(
      computeRoleplayOverallScore(MOCK_FEEDBACK.notas as RoleplayScoreBreakdown),
    );
    expect(result.breakdown.implicacao).toBe(4);
    expect(result.feedback.melhores_momentos).toHaveLength(3);
    expect(result.feedback.melhores_momentos[0]?.trecho).toContain('dia hoje');
    expect(result.feedback.perguntas_fracas).toHaveLength(3);
    expect(result.feedback.perguntas_fracas[0]?.reescrita).toContain('valer a pena');
    expect(result.feedback.perguntas_modelo).toHaveLength(2);
    expect(result.summary).toBe(MOCK_FEEDBACK.leitura_1_linha);
    expect(result.model).toBe('gpt-4o');
  });

  it('ignora qualquer nota global devolvida pelo modelo (score vem do código)', async () => {
    callGPT4oJSON.mockResolvedValueOnce({
      ...MOCK_FEEDBACK,
      overall_score: 99, // modelo "mentiu" — deve ser ignorado
      overallScore: 99,
    });
    const result = await runRoleplayAnalysis({ scenario: SCENARIO, transcript: 'abc' });
    expect(result.overallScore).toBe(
      computeRoleplayOverallScore(MOCK_FEEDBACK.notas as RoleplayScoreBreakdown),
    );
    expect(result.overallScore).not.toBe(99);
  });

  it('lança em transcrição vazia', async () => {
    await expect(
      runRoleplayAnalysis({ scenario: SCENARIO, transcript: '   ' }),
    ).rejects.toThrow('Transcrição vazia');
    expect(callGPT4oJSON).not.toHaveBeenCalled();
  });

  it('lança quando notas ausentes', async () => {
    callGPT4oJSON.mockResolvedValueOnce({ leitura_1_linha: 'x' });
    await expect(
      runRoleplayAnalysis({ scenario: SCENARIO, transcript: 'abc' }),
    ).rejects.toThrow('notas');
  });

  it('lança quando uma nota não é número', async () => {
    callGPT4oJSON.mockResolvedValueOnce({
      ...MOCK_FEEDBACK,
      notas: { ...MOCK_FEEDBACK.notas, implicacao: 'não é número' },
    });
    await expect(
      runRoleplayAnalysis({ scenario: SCENARIO, transcript: 'abc' }),
    ).rejects.toThrow('implicacao');
  });

  it('clampa nota fora de faixa para [0,10]', async () => {
    callGPT4oJSON.mockResolvedValueOnce({
      ...MOCK_FEEDBACK,
      notas: { ...MOCK_FEEDBACK.notas, implicacao: 50, situacao: -3 },
    });
    const result = await runRoleplayAnalysis({ scenario: SCENARIO, transcript: 'abc' });
    expect(result.breakdown.implicacao).toBe(10);
    expect(result.breakdown.situacao).toBe(0);
  });

  it('arrays ausentes viram [] sem quebrar', async () => {
    callGPT4oJSON.mockResolvedValueOnce({
      leitura_1_linha: 'x',
      notas: MOCK_FEEDBACK.notas,
      proximo_foco: 'y',
    });
    const result = await runRoleplayAnalysis({ scenario: SCENARIO, transcript: 'abc' });
    expect(result.feedback.melhores_momentos).toEqual([]);
    expect(result.feedback.perguntas_fracas).toEqual([]);
    expect(result.feedback.perguntas_modelo).toEqual([]);
  });
});

describe('runRoleplayTurn', () => {
  beforeEach(() => {
    callGPT4oChat.mockReset();
  });

  it('monta messages na ordem certa (system + closer→user/prospect→assistant)', async () => {
    callGPT4oChat.mockResolvedValueOnce('Ainda estou avaliando, pra ser sincera.');
    const result = await runRoleplayTurn({
      scenario: SCENARIO,
      history: [
        { role: 'closer', content: 'Oi, tudo bem? Me conta seu momento hoje.' },
        { role: 'prospect', content: 'Tudo. Tô meio perdida no posicionamento.' },
        { role: 'closer', content: 'E isso te atrapalha como no dia a dia?' },
      ],
    });

    expect(result.fala).toContain('avaliando');
    expect(callGPT4oChat).toHaveBeenCalledTimes(1);
    const messages = callGPT4oChat.mock.calls[0]?.[0] ?? [];
    expect(messages[0]?.role).toBe('system');
    expect(messages[1]).toEqual({ role: 'user', content: 'Oi, tudo bem? Me conta seu momento hoje.' });
    expect(messages[2]).toEqual({ role: 'assistant', content: 'Tudo. Tô meio perdida no posicionamento.' });
    expect(messages[3]?.role).toBe('user');
  });

  it('funciona com histórico vazio (closer fala primeiro depois)', async () => {
    callGPT4oChat.mockResolvedValueOnce('Oi!');
    const result = await runRoleplayTurn({ scenario: SCENARIO, history: [] });
    expect(result.fala).toBe('Oi!');
    const messages = callGPT4oChat.mock.calls[0]?.[0] ?? [];
    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe('system');
  });
});
