import { describe, expect, it } from 'vitest';
import { mapRespondiPayload, type QuestionMapping, type RespondiPayload } from './index';

const SAMPLE_MAPPING: QuestionMapping = {
  q_name: 'name',
  q_nickname: 'nickname',
  q_email: 'email',
  q_whatsapp: 'whatsappE164',
  q_instagram: 'instagramHandle',
  q_idade: 'idadeFaixa',
  q_tempo: 'tempoNoNichoFaixa',
  q_abordagem: 'abordagemPreferida',
  q_renda: 'rendaFaixa',
  q_orcamento: 'orcamentoFaixa',
  q_profissao: 'profissao',
  q_source: 'leadSourceSlug',
};

function basePayload(answers: { question_id: string; question_type: string; answer: unknown }[]): RespondiPayload {
  return {
    form: { form_id: 'CImh9589', form_name: 'Teste' },
    respondent: {
      date: '2026-05-04 14:00',
      respondent_id: 'test-uuid-1',
      score: 10,
      status: 'completed',
      respondent_utms: {
        utm_source: 'meta_ads',
        utm_medium: 'paid',
        utm_campaign: 'lancamento',
        utm_term: null,
        utm_content: null,
      },
      raw_answers: answers.map((a) => ({
        question: { question_id: a.question_id, question_title: a.question_id, question_type: a.question_type },
        answer: a.answer as never,
      })),
    },
  };
}

describe('mapRespondiPayload — happy path', () => {
  it('mapeia payload mínimo com nome + email + whatsapp', () => {
    const payload = basePayload([
      { question_id: 'q_name', question_type: 'text', answer: 'Bianca Manfredi' },
      { question_id: 'q_email', question_type: 'email', answer: 'bianca@example.com' },
      { question_id: 'q_whatsapp', question_type: 'text', answer: '55 11982776866' },
    ]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.name).toBe('Bianca Manfredi');
    expect(result.lead.email).toBe('bianca@example.com');
    expect(result.lead.whatsappE164).toBe('+5511982776866');
    expect(result.lead.intakeRespondentId).toBe('test-uuid-1');
  });

  it('captura UTMs', () => {
    const payload = basePayload([
      { question_id: 'q_name', question_type: 'text', answer: 'X' },
    ]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.utmSource).toBe('meta_ads');
    expect(result.lead.utmMedium).toBe('paid');
    expect(result.lead.utmCampaign).toBe('lancamento');
  });
});

describe('mapRespondiPayload — idade enum', () => {
  it.each([
    ['entre 19 e 24 anos', '19_a_24'],
    ['entre 25 e 34 anos', '25_a_34'],
    ['entre 35 e 44 anos', '35_a_44'],
    ['entre 45 e 54 anos', '45_a_54'],
    ['entre 55 e 64 anos', '55_a_64'],
  ])('mapeia "%s" → %s', (input, expected) => {
    const payload = basePayload([
      { question_id: 'q_idade', question_type: 'radio', answer: [input] },
    ]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.idadeFaixa).toBe(expected);
  });

  it('retorna null pra valor não reconhecido', () => {
    const payload = basePayload([
      { question_id: 'q_idade', question_type: 'radio', answer: ['100 anos'] },
    ]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.idadeFaixa).toBeNull();
  });
});

describe('mapRespondiPayload — tempo no nicho', () => {
  it.each([
    ['menos de 5 anos', 'menos_5'],
    ['entre 5 e 10 anos', '5_a_10'],
    ['entre 11 e 15 anos', '11_a_15'],
    ['mais de 16 anos', 'mais_16'],
  ])('mapeia "%s" → %s', (input, expected) => {
    const payload = basePayload([
      { question_id: 'q_tempo', question_type: 'radio', answer: [input] },
    ]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.tempoNoNichoFaixa).toBe(expected);
  });
});

describe('mapRespondiPayload — abordagem preferida', () => {
  it('detecta orientação sensível', () => {
    const payload = basePayload([
      {
        question_id: 'q_abordagem',
        question_type: 'radio',
        answer: ['busco uma orientação sensível e estratégica para que eu mesma aplique o necessário'],
      },
    ]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.abordagemPreferida).toBe('orientacao_sensivel');
  });

  it('detecta equipe constroi', () => {
    const payload = basePayload([
      {
        question_id: 'q_abordagem',
        question_type: 'radio',
        answer: ['consigo investir mais e ter uma equipe que construa tudo comigo'],
      },
    ]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.abordagemPreferida).toBe('equipe_constroi');
  });
});

describe('mapRespondiPayload — lead source', () => {
  it.each([
    ['através da Giu Salvatore', 'giu_salvatore_indicacao'],
    ['reels ou postagem no instagram de vocês', 'instagram_organico'],
    ['uma pessoa me indicou vocês', 'indicacao_pessoal'],
    ['Tik Tok', 'tiktok'],
    ['Podcast', 'podcast'],
    ['vi um post da Thais Roque sobre o branding', 'outro'],
  ])('mapeia "%s" → %s', (input, expected) => {
    const payload = basePayload([
      { question_id: 'q_source', question_type: 'radio', answer: [input] },
    ]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.leadSourceSlug).toBe(expected);
  });
});

describe('mapRespondiPayload — instagram handle normalization', () => {
  it('remove @ inicial', () => {
    const payload = basePayload([
      { question_id: 'q_instagram', question_type: 'text', answer: '@bianca_manfredi' },
    ]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.instagramHandle).toBe('bianca_manfredi');
  });

  it('remove URL completa', () => {
    const payload = basePayload([
      {
        question_id: 'q_instagram',
        question_type: 'text',
        answer: 'https://instagram.com/julianavieirahonorato/',
      },
    ]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.instagramHandle).toBe('julianavieirahonorato');
  });

  it('lowercase', () => {
    const payload = basePayload([
      { question_id: 'q_instagram', question_type: 'text', answer: 'Vilaniacosta.psicologia' },
    ]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.instagramHandle).toBe('vilaniacosta.psicologia');
  });
});

describe('mapRespondiPayload — filtros e erros', () => {
  it('rejeita status diferente de completed', () => {
    const payload = basePayload([
      { question_id: 'q_name', question_type: 'text', answer: 'X' },
    ]);
    payload.respondent.status = 'in_progress';
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid_status');
    expect(result.status).toBe('in_progress');
  });

  it('rejeita raw_answers vazio', () => {
    const payload = basePayload([]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('empty_payload');
  });

  it('registra question_ids não mapeados sem perder o resto', () => {
    const payload = basePayload([
      { question_id: 'q_name', question_type: 'text', answer: 'Bianca' },
      { question_id: 'q_pergunta_nova', question_type: 'text', answer: 'algo' },
    ]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.name).toBe('Bianca');
    expect(result.lead.unmappedQuestionIds).toEqual(['q_pergunta_nova']);
  });

  it('UTMs ausentes vão como null', () => {
    const payload = basePayload([
      { question_id: 'q_name', question_type: 'text', answer: 'X' },
    ]);
    payload.respondent.respondent_utms = null;
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.utmSource).toBeNull();
    expect(result.lead.utmMedium).toBeNull();
  });
});

describe('mapRespondiPayload — whatsapp errado', () => {
  it('captura erro de normalização mas não perde o lead', () => {
    const payload = basePayload([
      { question_id: 'q_name', question_type: 'text', answer: 'Marcelle' },
      { question_id: 'q_whatsapp', question_type: 'text', answer: '9,71971E+15' },
    ]);
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.whatsappE164).toBeNull();
    expect(result.lead.whatsappNormalizationError).toBe('scientific_notation');
    expect(result.lead.name).toBe('Marcelle');
  });
});

describe('mapRespondiPayload — date parsing em SP TZ', () => {
  it('parseia date sem TZ como horário SP', () => {
    const payload = basePayload([
      { question_id: 'q_name', question_type: 'text', answer: 'X' },
    ]);
    payload.respondent.date = '2026-05-04 14:00';
    const result = mapRespondiPayload(payload, SAMPLE_MAPPING);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 14:00 SP = 17:00 UTC
    expect(result.lead.receivedAt.toISOString()).toBe('2026-05-04T17:00:00.000Z');
  });
});
