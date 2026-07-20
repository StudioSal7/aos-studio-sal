// Monta o record plano de placeholders pro mail-merge do contrato (docxtemplater).
// Placeholder sem dado correspondente → string vazia, nunca undefined/null — o
// contrato é sempre um rascunho gerável, mesmo com dado incompleto.

import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { centsFromReaisInput, formatCents } from '../../../lib/money';
import { valorPorExtenso } from '../valor-extenso';

const OPERATION_TZ = process.env.NEXT_PUBLIC_OPERATION_TZ || 'America/Sao_Paulo';

const FORMA_PAGAMENTO_LABELS: Record<string, string> = {
  pix: 'PIX',
  cartao_credito: 'Cartão de crédito',
  boleto: 'Boleto',
  transferencia: 'Transferência bancária',
  parcelado: 'Parcelado',
  outro: 'Outro',
};

export type ContractLeadInput = {
  name: string | null;
  nickname?: string | null;
  email?: string | null;
  whatsappE164?: string | null;
  valorProposto?: string | null; // numeric string em reais (ex: "1997.00"), como persistido em leads.valorProposto
  formaPagamentoNegociada?: string | null;
};

export type ContractProductInput = {
  displayName: string;
} | null;

export type ContractEnderecoInput = {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
};

export type ContractCollectedData = {
  nomeCompleto?: string | null;
  cpfCnpj?: string | null;
  rg?: string | null;
  endereco?: ContractEnderecoInput | null;
  condicoesPagamento?: string | null;
  /** Vigência do contrato. Vazio → default PRAZO_DEFAULT ("6 (seis) meses"). Sobreponível. */
  prazo?: string | null;
};

// Vigência padrão quando o closer não informa — o documento final nunca sai com
// placeholder de "revisar". Sobreponível via coletado.prazo.
export const PRAZO_DEFAULT = '6 (seis) meses';

export type BuildContractDataInput = {
  lead: ContractLeadInput;
  product?: ContractProductInput;
  coletado: ContractCollectedData;
  /** Momento da geração — passado pelo chamador (server action), nunca lido internamente (mantém o módulo puro/testável). */
  dataGeracao?: Date;
};

function buildEndereco(endereco: ContractEnderecoInput | null | undefined): {
  concatenado: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
} {
  const e = endereco ?? {};
  const cidadeEstado = [e.cidade, e.estado].filter(Boolean).join('/');
  const linhaLogradouro = [e.logradouro, e.numero].filter(Boolean).join(', ');
  const concatenado = [linhaLogradouro, e.complemento, e.bairro, cidadeEstado, e.cep]
    .filter((part) => part && part.trim())
    .join(' — ');

  return {
    concatenado,
    logradouro: e.logradouro ?? '',
    numero: e.numero ?? '',
    complemento: e.complemento ?? '',
    bairro: e.bairro ?? '',
    cidade: e.cidade ?? '',
    estado: e.estado ?? '',
    cep: e.cep ?? '',
  };
}

/** Record plano — cada valor é sempre string (nunca undefined/null), pronto pro merge no .docx. */
export function buildContractData(input: BuildContractDataInput): Record<string, string> {
  const { lead, product, coletado, dataGeracao } = input;

  const valorCents = lead.valorProposto ? centsFromReaisInput(lead.valorProposto) : null;
  const endereco = buildEndereco(coletado.endereco);

  const formaPagamento = lead.formaPagamentoNegociada
    ? (FORMA_PAGAMENTO_LABELS[lead.formaPagamentoNegociada] ?? lead.formaPagamentoNegociada)
    : '';

  return {
    nome: lead.nickname || lead.name || '',
    nome_completo: coletado.nomeCompleto ?? '',
    cpf_cnpj: coletado.cpfCnpj ?? '',
    rg: coletado.rg ?? '',
    email: lead.email ?? '',
    whatsapp: lead.whatsappE164 ?? '',
    produto: product?.displayName ?? '',
    valor: valorCents !== null ? formatCents(valorCents) : '',
    valor_extenso: valorCents !== null ? valorPorExtenso(valorCents) : '',
    forma_pagamento: formaPagamento,
    condicoes_pagamento: coletado.condicoesPagamento ?? '',
    prazo: coletado.prazo?.trim() || PRAZO_DEFAULT,
    endereco: endereco.concatenado,
    endereco_logradouro: endereco.logradouro,
    endereco_numero: endereco.numero,
    endereco_complemento: endereco.complemento,
    endereco_bairro: endereco.bairro,
    endereco_cidade: endereco.cidade,
    endereco_estado: endereco.estado,
    endereco_cep: endereco.cep,
    data: dataGeracao ? format(toZonedTime(dataGeracao, OPERATION_TZ), 'dd/MM/yyyy') : '',
  };
}
