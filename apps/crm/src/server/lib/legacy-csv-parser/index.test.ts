import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseAbordagem,
  parseIdadeFaixa,
  parseLeadSource,
  parseLegacyCsvRow,
  parseLegacyCsvText,
  parsePontuacao,
  parseTempoNoNicho,
} from './index';

const FIXTURE_PATH = join(import.meta.dirname, 'fixtures', 'sample.csv');

function fixture(): string {
  return readFileSync(FIXTURE_PATH, 'utf-8');
}

describe('parseLegacyCsvRow — happy path', () => {
  it('parseia linha mínima com nome + email + status vazio', () => {
    const result = parseLegacyCsvRow({
      Nome: 'Bianca Manfredi',
      Email: 'bianca@example.com',
      WhatsApp: '',
      Status: '',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.name).toBe('Bianca Manfredi');
    expect(result.lead.email).toBe('bianca@example.com');
    expect(result.lead.stageSlug).toBe('application_received');
    expect(result.lead.needsManualReview).toBe(false);
  });

  it('parseia linha com whatsapp e sem email', () => {
    const result = parseLegacyCsvRow({ Nome: 'Ana', WhatsApp: '11999887766', Status: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.whatsappE164).toBe('+5511999887766');
    expect(result.lead.email).toBeNull();
  });

  it('normaliza instagram removendo @', () => {
    const result = parseLegacyCsvRow({
      Nome: 'Ju',
      Email: 'ju@example.com',
      Instagram: '@juliana',
      Status: '',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.instagramHandle).toBe('juliana');
  });
});

describe('parseLegacyCsvRow — mapeamento de status', () => {
  const cases: [string, string, string | null, boolean][] = [
    ['', 'application_received', null, false],
    ['pendente', 'application_received', null, false],
    ['analisar', 'under_review', null, false],
    ['aprovado', 'qualified', null, false],
    ['whatsapp enviado', 'first_contact_sent', null, false],
    ['reunião agendada', 'meeting_scheduled', null, false],
    ['reagendar encontro', 'meeting_scheduled', null, false],
    ['proposta enviada', 'proposal_sent', null, false],
    ['finalizado.', 'paid', null, false],
    ['recusada', 'lost', 'qualificacao_reprovada', false],
    ['não retornou.', 'lost', 'lead_silenciou', false],
    ['FAKE', 'lost', 'fake_spam', false],
    ['aguardar produto', 'under_review', null, true],
    ['aguardar mentoria', 'under_review', null, true],
    ['contato salvo', 'under_review', null, true],
  ];

  it.each(cases)(
    'status "%s" → slug "%s" / lossReason %s / manualReview %s',
    (status, expectedSlug, expectedLoss, expectedReview) => {
      const result = parseLegacyCsvRow({
        Nome: 'Test',
        Email: 'test@example.com',
        Status: status,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.lead.stageSlug).toBe(expectedSlug);
      expect(result.lead.lossReasonSlug).toBe(expectedLoss);
      expect(result.lead.needsManualReview).toBe(expectedReview);
    },
  );

  it('status "reunião agendada" cria meeting com status agendada', () => {
    const result = parseLegacyCsvRow({
      Nome: 'Fe',
      Email: 'fe@example.com',
      Status: 'reunião agendada',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.createMeeting).toBe(true);
    expect(result.lead.meetingStatus).toBe('agendada');
  });

  it('status "reagendar encontro" cria meeting com status reagendada', () => {
    const result = parseLegacyCsvRow({
      Nome: 'Ro',
      Email: 'ro@example.com',
      Status: 'reagendar encontro',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.createMeeting).toBe(true);
    expect(result.lead.meetingStatus).toBe('reagendada');
  });

  it('status desconhecido vira under_review + manual_review + flag unmappedStatus', () => {
    const result = parseLegacyCsvRow({
      Nome: 'X',
      Email: 'x@example.com',
      Status: 'em processo misterioso',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.stageSlug).toBe('application_received');
    expect(result.lead.needsManualReview).toBe(true);
    expect(result.lead.unmappedStatus).toBe(true);
  });
});

describe('parseLegacyCsvRow — erros de parsing', () => {
  it('rejeita linha sem nome', () => {
    const result = parseLegacyCsvRow({ Nome: '', Email: 'a@b.com', Status: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('missing_name');
  });

  it('rejeita linha sem nenhuma chave de dedup (sem email e sem whatsapp válido)', () => {
    const result = parseLegacyCsvRow({ Nome: 'Fulana', Email: '', WhatsApp: '', Status: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no_dedup_key');
  });

  it('captura erro de normalização de telefone mas não descarta a linha se tiver email', () => {
    const result = parseLegacyCsvRow({
      Nome: 'Leandro',
      Email: 'leandro@example.com',
      WhatsApp: '9,71971E+15',
      Status: 'pendente',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.whatsappE164).toBeNull();
    expect(result.lead.whatsappNormalizationError).toBe('scientific_notation');
    expect(result.lead.email).toBe('leandro@example.com');
  });

  it('descarta linha com telefone inválido E sem email', () => {
    const result = parseLegacyCsvRow({
      Nome: 'Sem Email',
      Email: '',
      WhatsApp: '9,71971E+15',
      Status: '',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no_dedup_key');
  });
});

describe('parseLegacyCsvText — arquivo completo de fixture', () => {
  it('parseia o fixture sem lançar exceção', () => {
    expect(() => parseLegacyCsvText(fixture())).not.toThrow();
  });

  it('importa a maioria das linhas com sucesso', () => {
    const { leads, failures } = parseLegacyCsvText(fixture());
    expect(leads.length).toBeGreaterThan(10);
    // Leandro (scientific notation + sem email) deve falhar
    expect(failures.some((f) => f.reason === 'no_dedup_key')).toBe(true);
  });

  it('detecta duplicatas de email intra-arquivo (Aline aparece 2x)', () => {
    const { duplicateEmailGroups } = parseLegacyCsvText(fixture());
    expect(duplicateEmailGroups).toContain('aline@example.com');
  });

  it('detecta duplicatas de whatsapp intra-arquivo', () => {
    const { duplicateWhatsappGroups } = parseLegacyCsvText(fixture());
    expect(duplicateWhatsappGroups.length).toBeGreaterThanOrEqual(1);
  });

  it('todos os leads com status "aguardar" vão para revisão manual', () => {
    const { leads } = parseLegacyCsvText(fixture());
    const manualReview = leads.filter(
      (l) =>
        l.rawStatus === 'aguardar produto' ||
        l.rawStatus === 'aguardar mentoria' ||
        l.rawStatus === 'contato salvo',
    );
    expect(manualReview.every((l) => l.needsManualReview)).toBe(true);
  });

  it('FAKE vai para lost com lossReasonSlug fake_spam', () => {
    const { leads } = parseLegacyCsvText(fixture());
    const fake = leads.find((l) => l.rawStatus === 'FAKE');
    expect(fake?.stageSlug).toBe('lost');
    expect(fake?.lossReasonSlug).toBe('fake_spam');
  });

  it('finalizado. vai para paid', () => {
    const { leads } = parseLegacyCsvText(fixture());
    const paid = leads.find((l) => l.rawStatus === 'finalizado.');
    expect(paid?.stageSlug).toBe('paid');
  });
});

describe('parseIdadeFaixa', () => {
  it('mapeia todas as faixas do CSV Respondi', () => {
    expect(parseIdadeFaixa('entre 19 e 24 anos')).toBe('19_a_24');
    expect(parseIdadeFaixa('entre 25 e 34 anos')).toBe('25_a_34');
    expect(parseIdadeFaixa('entre 35 e 44 anos')).toBe('35_a_44');
    expect(parseIdadeFaixa('entre 45 e 54 anos')).toBe('45_a_54');
    expect(parseIdadeFaixa('entre 55 e 64 anos')).toBe('55_a_64');
  });

  it('retorna null para entrada vazia ou desconhecida', () => {
    expect(parseIdadeFaixa('')).toBeNull();
    expect(parseIdadeFaixa('outra coisa')).toBeNull();
  });
});

describe('parseTempoNoNicho', () => {
  it('mapeia as faixas do CSV', () => {
    expect(parseTempoNoNicho('menos de 5 anos')).toBe('menos_5');
    expect(parseTempoNoNicho('entre 5 e 10 anos')).toBe('5_a_10');
    expect(parseTempoNoNicho('entre 11 e 15 anos')).toBe('11_a_15');
    expect(parseTempoNoNicho('mais de 16 anos')).toBe('mais_16');
  });

  it('retorna null para entradas vazias', () => {
    expect(parseTempoNoNicho('')).toBeNull();
  });
});

describe('parseAbordagem', () => {
  it('detecta orientacao_sensivel', () => {
    expect(
      parseAbordagem('busco uma orientação sensível e estratégica para que eu mesma aplique o necessário'),
    ).toBe('orientacao_sensivel');
  });

  it('detecta equipe_constroi', () => {
    expect(
      parseAbordagem('consigo investir mais e ter uma equipe que construa tudo comigo — com menos esforço da minha parte'),
    ).toBe('equipe_constroi');
  });

  it('retorna null para entrada vazia', () => {
    expect(parseAbordagem('')).toBeNull();
  });
});

describe('parseLeadSource', () => {
  it('detecta Giu Salvatore', () => {
    expect(parseLeadSource('através da Giu Salvatore')).toEqual({
      slug: 'giu_salvatore_indicacao',
      other: null,
    });
  });

  it('detecta Instagram orgânico', () => {
    expect(parseLeadSource('reels ou postagem no instagram de vocês')).toEqual({
      slug: 'instagram_organico',
      other: null,
    });
  });

  it('detecta indicação pessoal', () => {
    expect(parseLeadSource('uma pessoa me indicou vocês')).toEqual({
      slug: 'indicacao_pessoal',
      other: null,
    });
  });

  it('cai em outro com texto bruto preservado', () => {
    expect(parseLeadSource('via newsletter sei lá')).toEqual({
      slug: 'outro',
      other: 'via newsletter sei lá',
    });
  });

  it('@ ou URL vira indicacao_pessoal com handle preservado em other', () => {
    expect(parseLeadSource('@mansur_aline')).toEqual({
      slug: 'indicacao_pessoal',
      other: '@mansur_aline',
    });
    expect(parseLeadSource('https://www.linkedin.com/in/marilin-gonçalves')).toEqual({
      slug: 'indicacao_pessoal',
      other: 'https://www.linkedin.com/in/marilin-gonçalves',
    });
  });

  it('retorna ambos null para entrada vazia', () => {
    expect(parseLeadSource('')).toEqual({ slug: null, other: null });
  });
});

describe('parsePontuacao', () => {
  it('parseia inteiros', () => {
    expect(parsePontuacao('11')).toBe(11);
    expect(parsePontuacao('0')).toBe(0);
    expect(parsePontuacao('20')).toBe(20);
  });

  it('retorna null para vazio ou inválido', () => {
    expect(parsePontuacao('')).toBeNull();
    expect(parsePontuacao('abc')).toBeNull();
  });
});

describe('parseLegacyCsvRow — campos novos', () => {
  it('popula leadSourceSlug, idadeFaixa, pontuacao etc. quando o columnMap inclui as colunas', () => {
    const result = parseLegacyCsvRow(
      {
        Nome: 'Mari',
        Email: 'mari@example.com',
        Status: '',
        Fonte: 'através da Giu Salvatore',
        Idade: 'entre 35 e 44 anos',
        Renda: 'de R$15.000 a R$20.000 por mês',
        Orcamento: 'entre R$12.000 e R$15.000',
        TempoNicho: 'entre 11 e 15 anos',
        Pontuacao: '14',
        RespondentId: 'abc-123',
      },
      {
        nome: 'Nome',
        email: 'Email',
        status: 'Status',
        fonte: 'Fonte',
        idade: 'Idade',
        renda: 'Renda',
        orcamento: 'Orcamento',
        tempoNicho: 'TempoNicho',
        pontuacao: 'Pontuacao',
        respondentId: 'RespondentId',
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.leadSourceSlug).toBe('giu_salvatore_indicacao');
    expect(result.lead.idadeFaixa).toBe('35_a_44');
    expect(result.lead.rendaFaixa).toBe('de R$15.000 a R$20.000 por mês');
    expect(result.lead.orcamentoFaixa).toBe('entre R$12.000 e R$15.000');
    expect(result.lead.tempoNoNichoFaixa).toBe('11_a_15');
    expect(result.lead.pontuacao).toBe(14);
    expect(result.lead.intakeRespondentId).toBe('abc-123');
  });

  it('mantém retrocompat — colunas novas opcionais resultam em null', () => {
    const result = parseLegacyCsvRow({
      Nome: 'Test',
      Email: 'test@example.com',
      Status: '',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.leadSourceSlug).toBeNull();
    expect(result.lead.idadeFaixa).toBeNull();
    expect(result.lead.pontuacao).toBeNull();
    expect(result.lead.intakeRespondentId).toBeNull();
    expect(result.lead.rendaFaixa).toBeNull();
  });
});
