// UI metadata for the field→lead mapping selectors in the builder. Labels are
// PT-BR; the values must stay in sync with LeadMappingTarget (@repo/db) and the
// lead enum literals (idadeFaixa / abordagemPreferida / tempoNoNichoFaixa).

import type { LeadMappingTarget } from './types';

export interface LeadMappingOption {
  value: LeadMappingTarget;
  label: string;
  /** true → field needs a per-option enum map (leadEnumMap). */
  isEnum: boolean;
}

export const LEAD_MAPPING_OPTIONS: LeadMappingOption[] = [
  { value: 'name', label: 'Nome', isEnum: false },
  { value: 'nickname', label: 'Apelido', isEnum: false },
  { value: 'email', label: 'Email', isEnum: false },
  { value: 'whatsappE164', label: 'WhatsApp', isEnum: false },
  { value: 'instagramHandle', label: 'Instagram', isEnum: false },
  { value: 'cidade', label: 'Cidade', isEnum: false },
  { value: 'estado', label: 'Estado', isEnum: false },
  { value: 'profissao', label: 'Profissão', isEnum: false },
  { value: 'tempoNegocio', label: 'Tempo de negócio', isEnum: false },
  { value: 'rendaFaixa', label: 'Faixa de renda', isEnum: false },
  { value: 'orcamentoFaixa', label: 'Faixa de orçamento', isEnum: false },
  { value: 'idadeFaixa', label: 'Faixa de idade (enum)', isEnum: true },
  { value: 'abordagemPreferida', label: 'Abordagem preferida (enum)', isEnum: true },
  { value: 'tempoNoNichoFaixa', label: 'Tempo no nicho (enum)', isEnum: true },
  { value: 'leadSourceSlug', label: 'Origem do lead (slug)', isEnum: false },
];

// The valid enum literals per enum target, with PT-BR labels for the per-option
// selector. Values match the pgEnums in @repo/db/schema/enums.ts exactly.
export const LEAD_ENUM_VALUES: Record<string, { value: string; label: string }[]> = {
  idadeFaixa: [
    { value: '19_a_24', label: '19 a 24' },
    { value: '25_a_34', label: '25 a 34' },
    { value: '35_a_44', label: '35 a 44' },
    { value: '45_a_54', label: '45 a 54' },
    { value: '55_a_64', label: '55 a 64' },
  ],
  abordagemPreferida: [
    { value: 'orientacao_sensivel', label: 'Orientação sensível' },
    { value: 'equipe_constroi', label: 'Equipe constrói' },
  ],
  tempoNoNichoFaixa: [
    { value: 'menos_5', label: 'Menos de 5 anos' },
    { value: '5_a_10', label: '5 a 10 anos' },
    { value: '11_a_15', label: '11 a 15 anos' },
    { value: 'mais_16', label: 'Mais de 16 anos' },
  ],
};

export function isEnumTarget(t: LeadMappingTarget | null): boolean {
  if (!t) return false;
  return LEAD_MAPPING_OPTIONS.find((o) => o.value === t)?.isEnum ?? false;
}

// Resolve o literal cru de um enum (ex.: '25_a_34') para o label legível
// ('25 a 34'), reusando LEAD_ENUM_VALUES. Fallback no próprio valor quando não há
// mapeamento — usado no dossiê do lead para não exibir o literal do banco.
export function labelForLeadEnum(target: string, value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const found = LEAD_ENUM_VALUES[target]?.find((o) => o.value === value);
  return found?.label ?? value;
}
