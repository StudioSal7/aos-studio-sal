/**
 * Monta a thread de WhatsApp (texto) a partir das mensagens cruas da Evolution,
 * no formato consumido pelo prompt SDR.
 *
 * Módulo PURO (sem I/O) — testável isoladamente.
 *
 * Decisões (validadas na Etapa 0):
 *   - A Evolution retorna mensagens em ordem decrescente → reordenamos ascendente.
 *   - fromMe=true  → "SDR" (membro da Studio Sal).
 *   - fromMe=false → nome do lead (preferindo leadName fornecido > pushName > "lead").
 *   - messageTimestamp é Unix epoch em segundos → exibido em America/Sao_Paulo.
 *   - Mensagens sem texto (imagem/áudio/etc.) viram um marcador "[tipo]".
 */

import type { EvolutionMessage } from '../evolution-client';

const OPERATION_TZ = 'America/Sao_Paulo';

export interface BuildSdrThreadOptions {
  /** Nome do lead, usado como rótulo das mensagens recebidas (fromMe=false). */
  leadName?: string | null;
  /** Timezone de exibição (default America/Sao_Paulo). */
  timeZone?: string;
}

/** Extrai o texto exibível de uma mensagem, ou um marcador de mídia. */
function extractText(msg: EvolutionMessage): string {
  const body = msg.message;
  const text = body?.conversation ?? body?.extendedTextMessage?.text;
  if (text && text.trim()) return text.trim();

  // Sem texto: marcador legível baseado no tipo.
  const type = msg.messageType ?? 'mídia';
  const label = type
    .replace(/Message$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return `[${label || 'mídia'}]`;
}

function formatTimestamp(epochSeconds: number, timeZone: string): string {
  if (!epochSeconds || Number.isNaN(epochSeconds)) return '??';
  return new Date(epochSeconds * 1000).toLocaleString('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Constrói a thread como string única para alimentar o prompt SDR.
 * Lança erro se não houver mensagens (degradação tratada na server action).
 */
export function buildSdrThread(
  messages: EvolutionMessage[],
  opts: BuildSdrThreadOptions = {},
): string {
  if (!messages || messages.length === 0) {
    throw new Error('Nenhuma mensagem encontrada para este contato.');
  }

  const timeZone = opts.timeZone ?? OPERATION_TZ;

  // Rótulo do lead: leadName explícito > pushName de alguma msg recebida > "lead".
  const leadLabel =
    opts.leadName?.trim() ||
    messages.find((m) => !m.key.fromMe && m.pushName)?.pushName?.trim() ||
    'lead';

  const ordered = [...messages].sort(
    (a, b) => (a.messageTimestamp ?? 0) - (b.messageTimestamp ?? 0),
  );

  const lines = ordered.map((msg) => {
    const who = msg.key.fromMe ? 'SDR' : leadLabel;
    const when = formatTimestamp(msg.messageTimestamp, timeZone);
    const text = extractText(msg);
    return `[${when}] ${who}: ${text}`;
  });

  return lines.join('\n');
}

/**
 * Indica se a thread tem timestamps por mensagem utilizáveis para avaliar
 * `velocidade_resposta`. (Sempre true para Evolution — messageTimestamp existe.)
 */
export function threadHasPerMessageTimestamps(messages: EvolutionMessage[]): boolean {
  return messages.some((m) => typeof m.messageTimestamp === 'number' && m.messageTimestamp > 0);
}
