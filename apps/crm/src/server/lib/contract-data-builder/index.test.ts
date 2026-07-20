import { describe, expect, it } from 'vitest';
import { buildContractData } from './index';

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
});
