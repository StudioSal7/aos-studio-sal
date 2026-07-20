// Monta o record plano de placeholders pro mail-merge do contrato (docxtemplater).
// Placeholder sem dado correspondente → string vazia, nunca undefined/null — o
// contrato é sempre um rascunho gerável, mesmo com dado incompleto.

import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { centsFromReaisInput, formatCents } from '../../../lib/money';
import { numeroCardinalPorExtenso, valorPorExtenso } from '../valor-extenso';

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

// Pagamento estruturado — representação ÚNICA (nunca dois campos brigando).
// O total vem sempre de lead.valorProposto; no parcelado a parcela é DERIVADA
// (total ÷ nº, resto de centavos na última) para garantir parcela×nº == total.
export type PagamentoColetado =
  | { tipo: 'a_vista'; metodo?: string | null }
  | { tipo: 'parcelado'; metodo?: string | null; numParcelas: number; vencimento?: string | null };

export type ContractCollectedData = {
  nomeCompleto?: string | null;
  cpfCnpj?: string | null;
  rg?: string | null;
  endereco?: ContractEnderecoInput | null;
  /** @deprecated Substituído por `pagamento` estruturado (FIX 2). Mantido só para ler snapshots antigos. */
  condicoesPagamento?: string | null;
  pagamento?: PagamentoColetado | null;
  /** Vigência do contrato. Vazio → default PRAZO_DEFAULT ("6 (seis) meses"). Sobreponível. */
  prazo?: string | null;
};

// Vigência padrão quando o closer não informa — o documento final nunca sai com
// placeholder de "revisar". Sobreponível via coletado.prazo.
export const PRAZO_DEFAULT = '6 (seis) meses';

/**
 * Divide um total (cents) em `n` parcelas inteiras, jogando o resto de centavos
 * na última — assim base×(n-1) + last === total SEMPRE (sem inconsistência de
 * arredondamento tipo "3× R$665,67 = R$1997,01").
 */
export function derivarParcelas(totalCents: number, n: number): { base: number; last: number } {
  const parcelas = Math.max(1, Math.round(n));
  const base = Math.floor(totalCents / parcelas);
  const last = totalCents - base * (parcelas - 1);
  return { base, last };
}

// "dois/um" → "duas/uma" pra concordar com "parcelas" (feminino). Escopo mínimo.
function cardinalFeminino(n: number): string {
  return numeroCardinalPorExtenso(n)
    .replace(/\bum\b/g, 'uma')
    .replace(/\bdois\b/g, 'duas');
}

function metodoPagamentoLabel(metodo: string | null | undefined, formaLead: string | null | undefined): string {
  const raw = (metodo && metodo.trim()) || formaLead || '';
  return raw ? (FORMA_PAGAMENTO_LABELS[raw] ?? raw) : '';
}

/** String de pagamento ÚNICA e coerente (à vista | parcelado), consumida no resumo e na cláusula 4.1. */
function buildPagamento(input: {
  pagamento: PagamentoColetado | null | undefined;
  condicoesLegado: string | null | undefined;
  formaLead: string | null | undefined;
  totalCents: number | null;
}): string {
  const { pagamento, condicoesLegado, formaLead, totalCents } = input;

  // Snapshots antigos (pré-FIX 2): sem `pagamento` estruturado.
  if (!pagamento) {
    if (condicoesLegado && condicoesLegado.trim()) return condicoesLegado.trim();
    const label = metodoPagamentoLabel(null, formaLead);
    return label ? `à vista, via ${label}` : '';
  }

  const label = metodoPagamentoLabel(pagamento.metodo, formaLead);
  const via = label ? `, via ${label}` : '';

  if (pagamento.tipo === 'a_vista' || pagamento.numParcelas <= 1) {
    return `à vista${via}`;
  }

  const n = Math.round(pagamento.numParcelas);
  const nExt = cardinalFeminino(n);
  const venc =
    pagamento.vencimento && pagamento.vencimento.trim() ? `, com vencimento ${pagamento.vencimento.trim()}` : '';

  if (totalCents === null) {
    return `em ${n} (${nExt}) parcelas${via}${venc}`;
  }

  const { base, last } = derivarParcelas(totalCents, n);
  if (base === last) {
    return `em ${n} (${nExt}) parcelas de ${formatCents(base)}${via}${venc}`;
  }
  const viaSendo = label ? `${via}, ` : ', ';
  return `em ${n} (${nExt}) parcelas${viaSendo}sendo ${n - 1} de ${formatCents(base)} e a última de ${formatCents(last)}${venc}`;
}

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
    pagamento: buildPagamento({
      pagamento: coletado.pagamento,
      condicoesLegado: coletado.condicoesPagamento,
      formaLead: lead.formaPagamentoNegociada,
      totalCents: valorCents,
    }),
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
