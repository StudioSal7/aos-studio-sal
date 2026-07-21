/**
 * Monta o DRE Gerencial a partir de lançamentos já filtrados por competência
 * e período (a query fica fina por cima deste módulo — puro, sem banco).
 *
 * Convenção de sinal: receita soma positivo, despesa soma negativo — cada
 * seção acumula o valor JÁ com sinal, então os subtotais são soma direta
 * (sem casos especiais por seção). Isso também deixa o módulo correto mesmo
 * se uma categoria futura misturar receita/despesa numa mesma seção (ex.:
 * "outra").
 */

export type DreSection =
  | 'receita_bruta'
  | 'deducao'
  | 'imposto'
  | 'custo'
  | 'despesa_fixa'
  | 'despesa_variavel'
  | 'outra';

export interface DreLineInput {
  kind: 'receita' | 'despesa';
  dreSection: DreSection;
  amountCents: number; // sempre positivo — o sinal vem de `kind`
}

export interface DreSectionTotal {
  section: DreSection;
  label: string;
  totalCents: number; // já com sinal (receita +, despesa −)
}

export interface DreResult {
  sections: DreSectionTotal[];
  receitaLiquidaCents: number;
  lucroBrutoCents: number;
  resultadoLiquidoCents: number;
}

const SECTION_ORDER: DreSection[] = [
  'receita_bruta',
  'deducao',
  'imposto',
  'custo',
  'despesa_fixa',
  'despesa_variavel',
  'outra',
];

const SECTION_LABELS: Record<DreSection, string> = {
  receita_bruta: 'Receita Bruta',
  deducao: 'Deduções',
  imposto: 'Impostos',
  custo: 'Custos',
  despesa_fixa: 'Despesas Fixas',
  despesa_variavel: 'Despesas Variáveis',
  outra: 'Outras',
};

export function buildDre(entries: DreLineInput[]): DreResult {
  const totals = new Map<DreSection, number>(SECTION_ORDER.map((s) => [s, 0]));

  for (const entry of entries) {
    const signed = entry.kind === 'receita' ? entry.amountCents : -entry.amountCents;
    totals.set(entry.dreSection, (totals.get(entry.dreSection) ?? 0) + signed);
  }

  const get = (section: DreSection) => totals.get(section) ?? 0;

  const sections: DreSectionTotal[] = SECTION_ORDER.map((section) => ({
    section,
    label: SECTION_LABELS[section],
    totalCents: get(section),
  }));

  const receitaLiquidaCents = get('receita_bruta') + get('deducao') + get('imposto');
  const lucroBrutoCents = receitaLiquidaCents + get('custo');
  const resultadoLiquidoCents =
    lucroBrutoCents + get('despesa_fixa') + get('despesa_variavel') + get('outra');

  return { sections, receitaLiquidaCents, lucroBrutoCents, resultadoLiquidoCents };
}
