/**
 * Catálogo de métricas coloríveis do dashboard comercial — o registry é
 * código (chaves estáveis, não editáveis); a meta em si é dado, gravada em
 * `metric_targets` pelo owner via Admin. Métrica sem linha na tabela → cinza
 * na UI (nunca colorir no escuro).
 *
 * Import type-only de CommercialFunnelCounts: apagado na compilação, então
 * este módulo continua puro e testável sem banco.
 */

import type { CommercialFunnelCounts } from '@/server/queries/commercial-funnel';

export type MetricUnit = 'pct' | 'hours';
export type MetricComparator = 'gte' | 'lte';

export type MetricKey =
  | 'conv_form_to_qualified'
  | 'conv_qualified_to_first_contact'
  | 'conv_first_contact_to_meeting'
  | 'show_rate'
  | 'conv_meeting_to_proposal'
  | 'conv_proposal_to_sale'
  | 'ttfc_median_hours'
  | 'ttfc_within_24h_pct'
  | 'conv_global';

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: MetricUnit;
  defaultComparator: MetricComparator;
  // Só para taxas de fluxo do funil: par numerador/denominador em
  // CommercialFunnelCounts. Permite computar a MESMA taxa no grid semanal,
  // no funil e no KPI sem drift de fórmula.
  flow?: {
    numerator: keyof CommercialFunnelCounts;
    denominator: keyof CommercialFunnelCounts;
  };
}

export const METRIC_REGISTRY: readonly MetricDefinition[] = [
  {
    key: 'conv_form_to_qualified',
    label: 'form → qualificado',
    unit: 'pct',
    defaultComparator: 'gte',
    flow: { numerator: 'qualifiedReached', denominator: 'formResponses' },
  },
  {
    key: 'conv_qualified_to_first_contact',
    label: 'qualificado → 1º contato',
    unit: 'pct',
    defaultComparator: 'gte',
    flow: { numerator: 'firstContactReached', denominator: 'qualifiedReached' },
  },
  {
    key: 'conv_first_contact_to_meeting',
    label: '1º contato → reunião',
    unit: 'pct',
    defaultComparator: 'gte',
    flow: { numerator: 'meetingsScheduled', denominator: 'firstContactReached' },
  },
  {
    key: 'show_rate',
    label: 'agendada → realizada',
    unit: 'pct',
    defaultComparator: 'gte',
    flow: { numerator: 'meetingsAttended', denominator: 'meetingsScheduled' },
  },
  {
    key: 'conv_meeting_to_proposal',
    label: 'realizada → proposta',
    unit: 'pct',
    defaultComparator: 'gte',
    flow: { numerator: 'proposalsSent', denominator: 'meetingsAttended' },
  },
  {
    key: 'conv_proposal_to_sale',
    label: 'proposta → venda',
    unit: 'pct',
    defaultComparator: 'gte',
    flow: { numerator: 'salesWon', denominator: 'proposalsSent' },
  },
  {
    key: 'ttfc_median_hours',
    label: 'tempo até 1º contato (mediana)',
    unit: 'hours',
    defaultComparator: 'lte',
  },
  {
    key: 'ttfc_within_24h_pct',
    label: '% contatados em 24h',
    unit: 'pct',
    defaultComparator: 'gte',
  },
  {
    key: 'conv_global',
    label: 'conversão global',
    unit: 'pct',
    defaultComparator: 'gte',
    flow: { numerator: 'salesWon', denominator: 'leadsEntered' },
  },
];

export function metricByKey(key: string): MetricDefinition | undefined {
  return METRIC_REGISTRY.find((m) => m.key === key);
}

export function isMetricKey(value: string): value is MetricKey {
  return METRIC_REGISTRY.some((m) => m.key === value);
}
