import { describe, expect, it } from 'vitest';
import { UNCLASSIFIED_SEGMENT, classifySegment } from './index';
import type { SegmentRule } from '@/lib/ads.config';

const SEGMENTS: SegmentRule[] = [
  { key: 'frio', match: ['frio', 'cold', 'aberto'] },
  { key: 'quente', match: ['quente', 'rmkt', 'remarketing'] },
];

describe('ads-segment / classifySegment', () => {
  it('substring case-insensitive: FRIO em caps casa', () => {
    expect(classifySegment('[202601] [VENDAS] PÚBLICO FRIO – Método SAL', SEGMENTS)).toBe('frio');
  });

  it('rmkt → quente', () => {
    expect(classifySegment('[202602] rmkt 30d – Método SAL', SEGMENTS)).toBe('quente');
  });

  it('ordem do config é a precedência (nome com os dois termos → primeiro vence)', () => {
    expect(classifySegment('frio + remarketing teste', SEGMENTS)).toBe('frio');
  });

  it('sem match → nao_classificado (badge no dashboard, corrigir no config)', () => {
    expect(classifySegment('[202601] [ONGOING] [VENDAS] [LP] [F] – Método SAL', SEGMENTS)).toBe(
      UNCLASSIFIED_SEGMENT,
    );
  });

  it('lista de segmentos vazia → tudo nao_classificado', () => {
    expect(classifySegment('qualquer', [])).toBe(UNCLASSIFIED_SEGMENT);
  });
});
