import { describe, expect, it } from 'vitest';
import { mapFormAnswers, type MapperField, type FormAnswers } from './index';

const RECEIVED = new Date('2026-06-22T12:00:00-03:00');

function run(fields: MapperField[], answers: FormAnswers, utm?: Parameters<typeof mapFormAnswers>[0]['utm']) {
  return mapFormAnswers({
    fields,
    answers,
    intakeRespondentId: 'form:resp-1',
    receivedAt: RECEIVED,
    utm,
  });
}

describe('mapFormAnswers — text targets', () => {
  it('maps name, email (lowercased/trimmed), nickname', () => {
    const fields: MapperField[] = [
      { id: 'f1', leadMapping: 'name' },
      { id: 'f2', leadMapping: 'email' },
      { id: 'f3', leadMapping: 'nickname' },
    ];
    const { lead } = run(fields, { f1: 'Maria Silva', f2: '  MARIA@Example.COM ', f3: 'Bi' });
    expect(lead.name).toBe('Maria Silva');
    expect(lead.email).toBe('maria@example.com');
    expect(lead.nickname).toBe('Bi');
  });

  it('normalizes whatsapp to E.164', () => {
    const fields: MapperField[] = [{ id: 'w', leadMapping: 'whatsappE164' }];
    const { lead } = run(fields, { w: '(11) 98888-7777' });
    expect(lead.whatsappE164).toBe('+5511988887777');
    expect(lead.whatsappNormalizationError).toBeNull();
  });

  it('records whatsapp normalization error and leaves field null', () => {
    const fields: MapperField[] = [{ id: 'w', leadMapping: 'whatsappE164' }];
    const { lead } = run(fields, { w: '123' });
    expect(lead.whatsappE164).toBeNull();
    expect(lead.whatsappNormalizationError).toBe('too_short');
  });

  it('strips @ and URL from instagram handle', () => {
    const fields: MapperField[] = [{ id: 'ig', leadMapping: 'instagramHandle' }];
    expect(run(fields, { ig: '@Maria.Brand' }).lead.instagramHandle).toBe('maria.brand');
    expect(run(fields, { ig: 'https://instagram.com/Maria.Brand/' }).lead.instagramHandle).toBe(
      'maria.brand',
    );
  });

  it('passes leadSourceSlug through verbatim (chosen deterministically in builder)', () => {
    const fields: MapperField[] = [{ id: 's', leadMapping: 'leadSourceSlug' }];
    expect(run(fields, { s: 'instagram_organico' }).lead.leadSourceSlug).toBe('instagram_organico');
  });
});

describe('mapFormAnswers — enum targets (exact leadEnumMap lookup)', () => {
  const idadeField: MapperField = {
    id: 'idade',
    leadMapping: 'idadeFaixa',
    leadEnumMap: {
      'entre 19 e 24 anos': '19_a_24',
      'entre 25 e 34 anos': '25_a_34',
    },
  };

  it('translates an option via exact map match', () => {
    const { lead, enumLookupMisses } = run([idadeField], { idade: 'entre 25 e 34 anos' });
    expect(lead.idadeFaixa).toBe('25_a_34');
    expect(enumLookupMisses).toHaveLength(0);
  });

  it('records a miss and leaves the enum null when the value is not in the map', () => {
    const { lead, enumLookupMisses } = run([idadeField], { idade: 'tenho 40 anos' });
    expect(lead.idadeFaixa).toBeNull();
    expect(enumLookupMisses).toEqual([
      { fieldId: 'idade', target: 'idadeFaixa', value: 'tenho 40 anos' },
    ]);
  });

  it('does NOT fuzzy-match (a near value is a miss, not a guess)', () => {
    // "19 a 24" would match the Respondi fuzzy mapper, but here it must miss.
    const { lead, enumLookupMisses } = run([idadeField], { idade: '19 a 24' });
    expect(lead.idadeFaixa).toBeNull();
    expect(enumLookupMisses).toHaveLength(1);
  });

  it('maps abordagemPreferida and tempoNoNichoFaixa via their maps', () => {
    const fields: MapperField[] = [
      {
        id: 'ab',
        leadMapping: 'abordagemPreferida',
        leadEnumMap: { 'quero orientação sensível': 'orientacao_sensivel' },
      },
      {
        id: 'tn',
        leadMapping: 'tempoNoNichoFaixa',
        leadEnumMap: { 'menos de 5 anos': 'menos_5' },
      },
    ];
    const { lead } = run(fields, { ab: 'quero orientação sensível', tn: 'menos de 5 anos' });
    expect(lead.abordagemPreferida).toBe('orientacao_sensivel');
    expect(lead.tempoNoNichoFaixa).toBe('menos_5');
  });
});

describe('mapFormAnswers — unmapped and edge cases', () => {
  it('ignores fields with no leadMapping (they live only in dados)', () => {
    const fields: MapperField[] = [
      { id: 'q1', leadMapping: null },
      { id: 'q2' }, // no leadMapping at all
      { id: 'name', leadMapping: 'name' },
    ];
    const { lead } = run(fields, { q1: 'qualquer coisa', q2: 'outra', name: 'Ju' });
    expect(lead.name).toBe('Ju');
    // nothing leaked from q1/q2
    expect(lead.profissao).toBeNull();
  });

  it('joins multi-select arrays into a comma string', () => {
    const fields: MapperField[] = [{ id: 'p', leadMapping: 'profissao' }];
    expect(run(fields, { p: ['design', 'consultoria'] }).lead.profissao).toBe('design, consultoria');
  });

  it('coerces number and boolean answers to string', () => {
    const fields: MapperField[] = [
      { id: 'r', leadMapping: 'rendaFaixa' },
    ];
    expect(run(fields, { r: 5000 }).lead.rendaFaixa).toBe('5000');
  });

  it('captures UTM from input', () => {
    const { lead } = run([], {}, { utmSource: 'meta', utmMedium: 'paid', utmCampaign: 'jun' });
    expect(lead.utmSource).toBe('meta');
    expect(lead.utmMedium).toBe('paid');
    expect(lead.utmCampaign).toBe('jun');
  });

  it('carries intakeRespondentId and receivedAt through', () => {
    const { lead } = run([{ id: 'name', leadMapping: 'name' }], { name: 'X' });
    expect(lead.intakeRespondentId).toBe('form:resp-1');
    expect(lead.receivedAt).toBe(RECEIVED);
  });
});
