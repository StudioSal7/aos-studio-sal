import { describe, expect, it } from 'vitest';
import { buildContractData, derivarParcelas, isPessoaJuridica } from './index';

const baseLead = {
  name: 'Ana Beatriz Souza',
  nickname: 'Bia',
  email: 'bia@example.com',
  whatsappE164: '+5567999990000',
  valorProposto: '1997.00',
  formaPagamentoNegociada: 'pix',
};

const baseProduct = { displayName: 'Mentoria Salto' };

const baseColetado = {
  nomeCompleto: 'Ana Beatriz Souza Lima',
  cpfCnpj: '123.456.789-00',
  rg: '12.345.678-9',
  endereco: {
    logradouro: 'Rua das Flores',
    numero: '123',
    complemento: 'Apto 45',
    bairro: 'Centro',
    cidade: 'Campo Grande',
    estado: 'MS',
    cep: '79000-000',
  },
  condicoesPagamento: '3x de R$ 665,67 no cartão',
};

describe('buildContractData', () => {
  it('preenche todos os placeholders quando todo dado está presente', () => {
    const data = buildContractData({
      lead: baseLead,
      product: baseProduct,
      coletado: baseColetado,
      dataGeracao: new Date('2026-07-19T12:00:00Z'),
    });

    expect(data.nome).toBe('Bia');
    expect(data.nome_completo).toBe('Ana Beatriz Souza Lima');
    expect(data.cpf_cnpj).toBe('123.456.789-00');
    expect(data.rg).toBe('12.345.678-9');
    expect(data.email).toBe('bia@example.com');
    expect(data.whatsapp).toBe('+5567999990000');
    expect(data.produto).toBe('Mentoria Salto');
    expect(data.valor).toBe('R$\xa01.997,00');
    expect(data.valor_extenso).toBe('mil novecentos e noventa e sete reais');
    expect(data.forma_pagamento).toBe('PIX');
    expect(data.condicoes_pagamento).toBe('3x de R$ 665,67 no cartão');
    expect(data.endereco).toContain('Rua das Flores, 123');
    expect(data.endereco).toContain('Centro');
    expect(data.endereco).toContain('Campo Grande/MS');
    expect(data.endereco).toContain('79000-000');
    expect(data.endereco_logradouro).toBe('Rua das Flores');
    expect(data.endereco_cep).toBe('79000-000');
    expect(data.data).toBe('19/07/2026');
  });

  it('nickname ausente cai no name', () => {
    const data = buildContractData({
      lead: { ...baseLead, nickname: null },
      product: baseProduct,
      coletado: baseColetado,
    });
    expect(data.nome).toBe('Ana Beatriz Souza');
  });

  it('dados coletados ausentes viram string vazia, nunca quebra', () => {
    const data = buildContractData({
      lead: baseLead,
      product: baseProduct,
      coletado: {},
    });
    expect(data.nome_completo).toBe('');
    expect(data.cpf_cnpj).toBe('');
    expect(data.rg).toBe('');
    expect(data.condicoes_pagamento).toBe('');
    expect(data.endereco).toBe('');
    expect(data.endereco_logradouro).toBe('');
  });

  it('produto ausente vira string vazia', () => {
    const data = buildContractData({
      lead: baseLead,
      product: null,
      coletado: baseColetado,
    });
    expect(data.produto).toBe('');
  });

  it('valorProposto ausente/inválido não gera valor nem valor_extenso inventados', () => {
    const data = buildContractData({
      lead: { ...baseLead, valorProposto: null },
      product: baseProduct,
      coletado: baseColetado,
    });
    expect(data.valor).toBe('');
    expect(data.valor_extenso).toBe('');
  });

  it('endereco parcial concatena só os pedaços presentes', () => {
    const data = buildContractData({
      lead: baseLead,
      product: baseProduct,
      coletado: { endereco: { cidade: 'Campo Grande', estado: 'MS' } },
    });
    expect(data.endereco).toBe('Campo Grande/MS');
    expect(data.endereco_logradouro).toBe('');
  });

  it('forma de pagamento desconhecida (fora do enum) passa como veio, sem quebrar', () => {
    const data = buildContractData({
      lead: { ...baseLead, formaPagamentoNegociada: 'crypto' },
      product: baseProduct,
      coletado: baseColetado,
    });
    expect(data.forma_pagamento).toBe('crypto');
  });

  it('sem dataGeracao, placeholder de data sai vazio (não chama Date.now internamente)', () => {
    const data = buildContractData({
      lead: baseLead,
      product: baseProduct,
      coletado: baseColetado,
    });
    expect(data.data).toBe('');
  });

  describe('prazo (FIX 1)', () => {
    it('prazo omitido → default "6 (seis) meses", nunca [REVISAR]', () => {
      const data = buildContractData({ lead: baseLead, product: baseProduct, coletado: {} });
      expect(data.prazo).toBe('6 (seis) meses');
      expect(data.prazo).not.toMatch(/\[REVISAR/);
    });

    it('prazo vazio/espaços → default (não deixa em branco)', () => {
      const data = buildContractData({
        lead: baseLead,
        product: baseProduct,
        coletado: { prazo: '   ' },
      });
      expect(data.prazo).toBe('6 (seis) meses');
    });

    it('prazo informado sobrepõe o default', () => {
      const data = buildContractData({
        lead: baseLead,
        product: baseProduct,
        coletado: { prazo: '12 (doze) meses' },
      });
      expect(data.prazo).toBe('12 (doze) meses');
    });

    it('nenhum valor do record contém "[REVISAR"', () => {
      const data = buildContractData({ lead: baseLead, product: baseProduct, coletado: {} });
      for (const v of Object.values(data)) {
        expect(v).not.toMatch(/\[REVISAR/);
      }
    });
  });

  describe('pagamento estruturado (FIX 2)', () => {
    it('derivarParcelas: soma das parcelas == total sempre (resto na última)', () => {
      // 1997,00 / 3 = 665,66 ×2 + 665,68 (não 665,67 ×3 = 1997,01)
      const { base, last } = derivarParcelas(199700, 3);
      expect(base).toBe(66566);
      expect(last).toBe(66568);
      expect(base * 2 + last).toBe(199700);
    });

    it('derivarParcelas: invariante base×(n-1)+last == total para vários casos', () => {
      for (const [total, n] of [
        [199700, 3],
        [180000, 3],
        [1000000, 7],
        [12345, 5],
        [100, 3],
      ] as const) {
        const { base, last } = derivarParcelas(total, n);
        expect(base * (n - 1) + last).toBe(total);
      }
    });

    it('parcelado: representação única, coerente, sem contradição com o total', () => {
      const data = buildContractData({
        lead: { ...baseLead, valorProposto: '1997.00', formaPagamentoNegociada: 'pix' },
        product: baseProduct,
        coletado: {
          pagamento: { tipo: 'parcelado', metodo: 'cartao_credito', numParcelas: 3, vencimento: 'todo dia 10' },
        },
      });
      // NÃO menciona PIX (forma do lead) — a estrutura de pagamento é a única fonte
      expect(data.pagamento).not.toMatch(/PIX/);
      expect(data.pagamento).toContain('3 (três) parcelas');
      expect(data.pagamento).toContain('Cartão de crédito');
      expect(data.pagamento).toContain('vencimento todo dia 10');
      // valores derivados coerentes: 2 de 665,66 + última 665,68
      expect(data.pagamento).toContain('665,66');
      expect(data.pagamento).toContain('665,68');
    });

    it('parcelado divisível exato: parcelas iguais', () => {
      const data = buildContractData({
        lead: { ...baseLead, valorProposto: '1800.00' },
        product: baseProduct,
        coletado: { pagamento: { tipo: 'parcelado', metodo: 'boleto', numParcelas: 3 } },
      });
      expect(data.pagamento).toContain('3 (três) parcelas de R$\xa0600,00');
    });

    it('à vista: método + total, sem parcelas', () => {
      const data = buildContractData({
        lead: baseLead,
        product: baseProduct,
        coletado: { pagamento: { tipo: 'a_vista', metodo: 'pix' } },
      });
      expect(data.pagamento).toBe('à vista, via PIX');
    });

    it('parcela feminina (uma/duas), não "um/dois parcelas"', () => {
      const data = buildContractData({
        lead: { ...baseLead, valorProposto: '1000.00' },
        product: baseProduct,
        coletado: { pagamento: { tipo: 'parcelado', metodo: 'pix', numParcelas: 2 } },
      });
      expect(data.pagamento).toContain('2 (duas) parcelas');
    });

    it('snapshot antigo (condicoesPagamento free text, sem pagamento) ainda renderiza (compat)', () => {
      const data = buildContractData({
        lead: baseLead,
        product: baseProduct,
        coletado: { condicoesPagamento: '3x no cartão' },
      });
      expect(data.pagamento).toBe('3x no cartão');
    });
  });

  describe('qualificação PF/PJ do contratante (FIX 5)', () => {
    it('isPessoaJuridica detecta pelo formato (14 dígitos = CNPJ)', () => {
      expect(isPessoaJuridica('17.026.137/0001-18')).toBe(true);
      expect(isPessoaJuridica('958.957.601-04')).toBe(false); // CPF
      expect(isPessoaJuridica('')).toBe(false);
      expect(isPessoaJuridica(null)).toBe(false);
    });

    it('PF: RG + CPF, sem "pessoa jurídica" nem representante', () => {
      const data = buildContractData({
        lead: { ...baseLead, email: 'l@ex.com', whatsappE164: '+5562999990000' },
        product: baseProduct,
        coletado: {
          nomeCompleto: 'Lorena Vieira Alves',
          cpfCnpj: '958.957.601-04',
          rg: '958.957.601-04',
          nacionalidade: 'brasileira',
          profissao: 'psicóloga',
          endereco: { logradouro: 'Av C255', numero: '287', cidade: 'Goiânia', estado: 'GO', cep: '74280010' },
        },
      });
      const q = data.qualificacao_contratante ?? '';
      expect(q).toContain('Lorena Vieira Alves');
      expect(q).toContain('brasileira');
      expect(q).toContain('psicóloga');
      expect(q).toContain('portador(a) do RG nº 958.957.601-04');
      expect(q).toContain('inscrito(a) no CPF nº 958.957.601-04');
      expect(q).toContain('residente e domiciliado(a) em');
      expect(q).not.toContain('pessoa jurídica');
      expect(q).not.toContain('representada');
      expect(q).not.toContain('CNPJ');
    });

    it('PJ: razão social + CNPJ + sede + representante, SEM "portador do RG" da própria PJ', () => {
      const data = buildContractData({
        lead: { ...baseLead, email: 'rci@ex.com', whatsappE164: '+5513999990000' },
        product: baseProduct,
        coletado: {
          nomeCompleto: 'RCI Imóveis LTDA',
          cpfCnpj: '17.026.137/0001-18',
          representanteNome: 'Janaína Kadja Silva Pitanga',
          representanteRg: '34.994.653-X',
          representanteCpf: '270.978.148-45',
          endereco: { logradouro: 'Rua Visconde de Pirajá', numero: '414', cidade: 'Rio de Janeiro', estado: 'RJ', cep: '22410-002' },
        },
      });
      const q = data.qualificacao_contratante ?? '';
      expect(q).toContain('RCI Imóveis LTDA');
      expect(q).toContain('pessoa jurídica de direito privado');
      expect(q).toContain('inscrita no CNPJ sob o nº 17.026.137/0001-18');
      expect(q).toContain('com sede em');
      expect(q).toContain('neste ato representada por Janaína Kadja Silva Pitanga');
      expect(q).toContain('RG nº 34.994.653-X');
      expect(q).toContain('CPF nº 270.978.148-45');
      // não pode dizer que a PRÓPRIA PJ é "portador(a) do RG" (o bug do FIX 5)
      expect(q).not.toMatch(/LTDA, portador\(a\) do RG/);
      expect(q).not.toContain('residente e domiciliado');
    });

    it('campos ausentes não deixam vírgula solta / placeholder vazio', () => {
      const data = buildContractData({
        lead: { ...baseLead, email: null, whatsappE164: null },
        product: baseProduct,
        coletado: { nomeCompleto: 'Fulana', cpfCnpj: '111.222.333-44' },
      });
      const q = data.qualificacao_contratante ?? '';
      expect(q).not.toMatch(/,\s*,/);
      expect(q).not.toMatch(/,\s*$/);
      expect(q.startsWith('Fulana')).toBe(true);
    });
  });
});
