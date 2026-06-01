// Limpador determinístico de transcrição "Anotações do Gemini" (Google Meet).
//
// Remove APENAS ruído estrutural inequívoco — nunca toca nas falas, então
// preserva 100% das citações literais que a régua exige. É a primeira linha de
// defesa de tokens (custo zero, sem latência) antes de recorrer à compressão
// extrativa via modelo.
//
// Formato de entrada (verificado em amostras reais):
//   ﻿29 de mai. de 2026                         ← BOM + linha de data
//   Studio Sal & Fulana  - Transcrição          ← header
//   00:00:00                                     ← timestamp inicial
//   <linha em branco>
//   Renata Restaino: fala...                     ← "Nome Completo: fala"
//   Luciana Arouca: fala...
//   <branco> 00:01:48 <branco>                   ← timestamp a cada ~1 min
//   ...
//
// O que removemos:
//   - BOM (﻿) e char de substituição de mojibake (�, "�")
//   - Linhas de timestamp isoladas (HH:MM:SS)
//   - Linha de data ("29 de mai. de 2026") e header ("... - Transcrição")
//   - Linhas em branco (colapsadas)
//   - Prefixo de falante repetido em linhas CONSECUTIVAS do mesmo falante
//     (junta a continuação na mesma linha — atribuição preservada, 1 nome/turno)
//
// O que NUNCA removemos: interjeições curtas ("Mhm", "Perfeito.", "Sì") — são
// sinal de escuta ativa / rapport — nem qualquer conteúdo de fala.

export interface CleanTranscriptResult {
  cleaned: string;
  estimatedTokens: number; // heurística chars/4 (pt-BR)
  removed: { timestamps: number; blankLines: number; metaLines: number };
}

const TIMESTAMP_RE = /^\d{1,2}:\d{2}:\d{2}$/; // 00:00:00 / 1:18:29
const DATE_RE = /^\d{1,2}\s+de\s+[a-zç.]+\.?\s+de\s+\d{4}$/i; // "29 de mai. de 2026"
const HEADER_RE = /-\s*Transcri[çc][ãa]o\s*$/i; // "Studio Sal & Fulana - Transcrição"
const SPEAKER_RE = /^([\p{L}][\p{L}.\-']*(?:\s+[\p{L}.\-']+){0,4}):\s?(.*)$/u; // "Nome Completo: fala"

/** Estima tokens por heurística simples de caracteres (pt-BR ≈ 4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function cleanGeminiTranscript(raw: string): CleanTranscriptResult {
  const removed = { timestamps: 0, blankLines: 0, metaLines: 0 };

  // Normaliza quebras de linha, remove BOM e char de substituição.
  const normalized = raw
    .replace(/﻿/g, '')
    .replace(/�/g, '')
    .replace(/\r\n?/g, '\n');

  const lines = normalized.split('\n');

  // Passo 1 — descarta ruído estrutural linha a linha.
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (trimmed === '') {
      removed.blankLines++;
      continue;
    }
    if (TIMESTAMP_RE.test(trimmed)) {
      removed.timestamps++;
      continue;
    }
    // Metadata só no topo do arquivo (primeiras linhas antes do diálogo).
    if (kept.length === 0 && (DATE_RE.test(trimmed) || HEADER_RE.test(trimmed))) {
      removed.metaLines++;
      continue;
    }

    kept.push(trimmed);
  }

  // Passo 2 — colapsa linhas consecutivas do MESMO falante num só turno.
  const turns: string[] = [];
  let lastSpeaker: string | null = null;

  for (const line of kept) {
    const m = line.match(SPEAKER_RE);
    if (m) {
      const speaker = m[1]!.trim();
      const speech = (m[2] ?? '').trim();
      if (speaker === lastSpeaker && turns.length > 0) {
        // Mesma pessoa continuou: anexa a fala sem repetir o nome.
        turns[turns.length - 1] += speech ? ` ${speech}` : '';
      } else {
        turns.push(`${speaker}: ${speech}`);
        lastSpeaker = speaker;
      }
    } else {
      // Linha sem rótulo de falante (continuação de fala quebrada): anexa.
      if (turns.length > 0) {
        turns[turns.length - 1] += ` ${line}`;
      } else {
        turns.push(line);
      }
      // mantém lastSpeaker (a continuação é do mesmo falante)
    }
  }

  const cleaned = turns.join('\n').replace(/[ \t]{2,}/g, ' ').trim();

  return { cleaned, estimatedTokens: estimateTokens(cleaned), removed };
}
