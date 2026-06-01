import { describe, it, expect } from 'vitest';
import { cleanGeminiTranscript, estimateTokens } from '../transcript-cleaner';

const SAMPLE = `﻿29 de mai. de 2026
Studio Sal & Luciana Arouca  - Transcrição
00:00:00

Renata Restaino: Oi, tudo bem?
Luciana Arouca: Tudo, e você?

00:01:48

Luciana Arouca: Então, eu queria explorar minha marca pessoal,
Luciana Arouca: porque sinto que tenho algo a dizer.
Renata Restaino: Perfeito.
Renata Restaino: Me conta mais.

01:18:29

Luciana Arouca: Era isso. 14. �`;

describe('cleanGeminiTranscript', () => {
  const out = cleanGeminiTranscript(SAMPLE);

  it('remove BOM, data, header e timestamps', () => {
    expect(out.cleaned).not.toContain('﻿');
    expect(out.cleaned).not.toMatch(/de mai\. de 2026/);
    expect(out.cleaned).not.toMatch(/Transcri/);
    expect(out.cleaned).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(out.removed.timestamps).toBe(3);
    expect(out.removed.metaLines).toBe(2);
  });

  it('remove char de substituição de mojibake', () => {
    expect(out.cleaned).not.toContain('�');
  });

  it('preserva as falas (citações literais intactas)', () => {
    expect(out.cleaned).toContain('explorar minha marca pessoal');
    expect(out.cleaned).toContain('Me conta mais');
    expect(out.cleaned).toContain('algo a dizer');
  });

  it('preserva interjeições curtas (sinal de escuta/rapport)', () => {
    expect(out.cleaned).toContain('Perfeito.');
  });

  it('colapsa linhas consecutivas do mesmo falante num turno', () => {
    // As duas falas seguidas da Luciana viram uma linha só, com 1 prefixo.
    const luBlocks = out.cleaned
      .split('\n')
      .filter((l) => l.startsWith('Luciana Arouca:'));
    const merged = luBlocks.find((l) => l.includes('explorar minha marca'));
    expect(merged).toContain('algo a dizer'); // as duas falas juntas
    // Renata também: "Perfeito." + "Me conta mais" num só turno
    const reBlocks = out.cleaned.split('\n').filter((l) => l.startsWith('Renata Restaino:'));
    const reMerged = reBlocks.find((l) => l.includes('Perfeito'));
    expect(reMerged).toContain('Me conta mais');
  });

  it('estima tokens e reduz vs. o bruto', () => {
    expect(out.estimatedTokens).toBeGreaterThan(0);
    expect(out.estimatedTokens).toBeLessThan(estimateTokens(SAMPLE));
  });

  it('é idempotente o suficiente: sem linhas em branco no resultado', () => {
    expect(out.cleaned.split('\n').every((l) => l.trim().length > 0)).toBe(true);
  });
});
