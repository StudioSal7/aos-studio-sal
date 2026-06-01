// Compressão EXTRATIVA de fallback — só usada quando, após a limpeza
// determinística, a transcrição ainda excede o teto de tokens do tier.
//
// Princípio: NUNCA reescrever fala (preserva citações literais). O modelo só
// SELECIONA quais turnos manter (verbatim); a reconstrução é feita por código a
// partir dos turnos originais. Uma trava determinística garante o teto mesmo se
// o modelo selecionar demais (mantém abertura + fechamento, as regiões críticas).

import { callGPT4oJSON } from '../openai';
import { estimateTokens } from './transcript-cleaner';

export interface CompressResult {
  transcript: string;
  compressed: boolean;
}

const COMPRESSOR_MODEL = 'gpt-4o-mini';

function buildSelectionPrompt(numberedTurns: string, targetTokens: number): string {
  return `Você recebe uma transcrição de call comercial dividida em turnos numerados.
Selecione quais turnos MANTER para caber em ~${targetTokens} tokens, preservando:
- diagnóstico da dor, construção de desejo e de implicação (custo de não agir),
- apresentação de valor/preço e o fechamento/próximos passos,
- objeções e como foram tratadas.
Descarte small talk redundante e repetições. NÃO reescreva nada — apenas selecione.

Responda APENAS com JSON: { "keep": [<índices dos turnos a manter, em ordem>] }

Turnos:
${numberedTurns}`;
}

/** Trava determinística: mantém turnos do início e do fim até caber no teto. */
function headTailCap(turns: string[], ceiling: number): string[] {
  if (estimateTokens(turns.join('\n')) <= ceiling) return turns;
  const out: string[] = [];
  let head = 0;
  let tail = turns.length - 1;
  let tokens = 0;
  let takeHead = true;
  while (head <= tail) {
    const idx = takeHead ? head : tail;
    const t = turns[idx]!;
    const cost = estimateTokens(t) + 1;
    if (tokens + cost > ceiling) break;
    if (takeHead) {
      out.push(t);
      head++;
    } else {
      out.unshift(t);
      tail--;
    }
    tokens += cost;
    takeHead = !takeHead;
  }
  return out;
}

/**
 * Comprime extrativamente a transcrição limpa para caber no teto.
 * Se a seleção do modelo falhar, recai na trava determinística head+tail.
 */
export async function compressTranscript(
  cleaned: string,
  ceiling: number,
): Promise<CompressResult> {
  if (estimateTokens(cleaned) <= ceiling) {
    return { transcript: cleaned, compressed: false };
  }

  const turns = cleaned.split('\n').filter((t) => t.trim().length > 0);
  const numbered = turns.map((t, i) => `[${i}] ${t}`).join('\n');
  const target = Math.floor(ceiling * 0.85); // folga pro prompt do sistema

  let selected: string[] = turns;
  try {
    const raw = await callGPT4oJSON(buildSelectionPrompt(numbered, target), 'Selecione os turnos.', {
      model: COMPRESSOR_MODEL,
      maxTokens: 2048,
    });
    const keep = (raw as { keep?: unknown })?.keep;
    if (Array.isArray(keep)) {
      const idxs = keep
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < turns.length)
        .sort((a, b) => a - b);
      if (idxs.length > 0) selected = idxs.map((i) => turns[i]!);
    }
  } catch {
    // Falha do compressor → cai direto na trava determinística abaixo.
    selected = turns;
  }

  // Garante o teto independentemente do que o modelo retornou.
  const capped = headTailCap(selected, target);
  return { transcript: capped.join('\n'), compressed: true };
}
