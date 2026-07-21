/**
 * ads-segment — classifica campanha → segmento pelo padrão de nome. PURO.
 *
 * Match por substring case-insensitive; a ORDEM da lista no config é a
 * precedência (primeiro SegmentRule que casar vence). Sem match →
 * 'nao_classificado' — o dashboard exibe badge denunciando campanha fora da
 * convenção de nome (o config é a superfície pra corrigir, não o código).
 */

import type { SegmentRule } from '@/lib/ads.config';

export const UNCLASSIFIED_SEGMENT = 'nao_classificado';

export function classifySegment(campaignName: string, segments: SegmentRule[]): string {
  const name = campaignName.toLowerCase();
  for (const rule of segments) {
    if (rule.match.some((term) => name.includes(term.toLowerCase()))) return rule.key;
  }
  return UNCLASSIFIED_SEGMENT;
}
