/**
 * Evolution API client — pull sob demanda de conversas de WhatsApp para análise SDR.
 *
 * NÃO persiste mensagens. Apenas puxa (findMessages / findChats) e resolve o
 * remoteJid de um número. A thread montada é gravada como `transcript` em
 * `commercial_analyses` pelas server actions.
 *
 * Descobertas da instância (validadas na Etapa 0):
 *   - A API retorna mensagens em ordem DECRESCENTE (mais nova primeiro).
 *     O thread-builder reordena por messageTimestamp ascendente.
 *   - Contatos individuais aparecem como `@s.whatsapp.net` (número no JID) OU
 *     `@lid` (identificador opaco — número só em lastMessage.key.remoteJidAlt).
 *   - `limit: 500` traz conversas completas sem truncar (observado: ~20–35 msgs).
 */

const DEFAULT_LIMIT = 500;

// ── Tipos da Evolution API v2 ────────────────────────────────────────────────

export interface EvolutionMessageKey {
  id: string;
  fromMe: boolean;
  remoteJid: string;
  /** Em chats @lid, traz o número real (ex: "5524988321887@s.whatsapp.net"). */
  remoteJidAlt?: string;
  participant?: string;
}

export interface EvolutionMessage {
  key: EvolutionMessageKey;
  pushName?: string | null;
  messageType?: string;
  messageTimestamp: number; // Unix epoch em segundos
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    [k: string]: unknown;
  } | null;
}

export interface EvolutionChat {
  id: string;
  remoteJid: string;
  pushName?: string | null;
  name?: string | null;
  profilePicUrl?: string | null;
  updatedAt?: string | null;
  lastMessage?: {
    messageTimestamp?: number;
    key?: EvolutionMessageKey;
  } | null;
}

// ── Config ───────────────────────────────────────────────────────────────────

interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instance: string;
}

function getConfig(): EvolutionConfig {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;

  if (!baseUrl || !apiKey || !instance) {
    throw new Error(
      'Evolution API não configurada: defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE.',
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, instance };
}

async function evolutionPost<T>(path: string, body: unknown): Promise<T> {
  const cfg = getConfig();
  const url = `${cfg.baseUrl}${path}/${encodeURIComponent(cfg.instance)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { apikey: cfg.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Evolution API ${res.status} em ${path}: ${text.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

// ── JID helpers ──────────────────────────────────────────────────────────────

/** "+5511999998888" → "5511999998888@s.whatsapp.net" */
export function e164ToRemoteJid(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

/** Extrai só os dígitos de um remoteJid ("5511...@s.whatsapp.net" → "5511..."). */
export function remoteJidToDigits(remoteJid: string): string {
  return remoteJid.split('@')[0]!.replace(/\D/g, '');
}

/**
 * Variantes de um número brasileiro tolerando presença/ausência do 9º dígito.
 * Cadastro e WhatsApp podem divergir no "9" após o DDD (ajuste #1 do plano).
 *   "5511999718595" (13) ⇄ "551199718595"  (12)   ← wait: see below
 * Mobile BR E.164: 55 + DD(2) + 9 + 8 dígitos = 13. Sem o 9 = 12.
 */
export function brazilianPhoneVariants(digits: string): string[] {
  const variants = new Set<string>([digits]);

  if (digits.startsWith('55')) {
    const rest = digits.slice(2); // DDD + número local
    if (rest.length === 11 && rest[2] === '9') {
      // 13 dígitos com 9 → também sem o 9
      variants.add('55' + rest.slice(0, 2) + rest.slice(3));
    } else if (rest.length === 10) {
      // 12 dígitos sem 9 → também com o 9 (inserido após o DDD)
      variants.add('55' + rest.slice(0, 2) + '9' + rest.slice(2));
    }
  }

  return [...variants];
}

// ── API ──────────────────────────────────────────────────────────────────────

interface FindMessagesResponse {
  messages?: {
    total?: number;
    pages?: number;
    currentPage?: number;
    records?: EvolutionMessage[];
  };
}

/**
 * Puxa todas as mensagens de um chat (por remoteJid exato).
 * Retorna na ordem crua da API (decrescente). Reordene no thread-builder.
 */
export async function findMessages(
  remoteJid: string,
  opts: { limit?: number } = {},
): Promise<EvolutionMessage[]> {
  const data = await evolutionPost<FindMessagesResponse>('/chat/findMessages', {
    where: { key: { remoteJid } },
    limit: opts.limit ?? DEFAULT_LIMIT,
  });
  return data.messages?.records ?? [];
}

interface FindChatsResponse {
  records?: EvolutionChat[];
}

/** Lista todos os chats da instância (Porta 2). */
export async function findChats(): Promise<EvolutionChat[]> {
  const data = await evolutionPost<FindChatsResponse | EvolutionChat[]>('/chat/findChats', {});
  if (Array.isArray(data)) return data;
  return data.records ?? [];
}

/**
 * Resolve o remoteJid real de um número E.164, lidando com:
 *   1. Contatos @s.whatsapp.net (número no JID) — caminho rápido, sem findChats.
 *   2. Contatos @lid (número opaco) — varre findChats casando por remoteJidAlt.
 *   3. Divergência do 9º dígito BR (tenta variantes).
 *
 * Retorna o remoteJid que tem mensagens, ou null se nenhuma conversa for achada.
 */
export async function resolveRemoteJid(e164: string): Promise<string | null> {
  const digits = e164.replace(/\D/g, '');
  const variants = brazilianPhoneVariants(digits);

  // 1. Caminho rápido: tenta cada variante como @s.whatsapp.net.
  for (const v of variants) {
    const jid = `${v}@s.whatsapp.net`;
    const msgs = await findMessages(jid, { limit: 1 });
    if (msgs.length > 0) return jid;
  }

  // 2. Fallback @lid: varre os chats e casa por dígitos (JID ou remoteJidAlt).
  const wanted = new Set(variants);
  const chats = await findChats();
  for (const chat of chats) {
    const jid = chat.remoteJid || chat.id;
    if (!jid) continue;

    const candidates = new Set<string>();
    candidates.add(remoteJidToDigits(jid));
    const alt = chat.lastMessage?.key?.remoteJidAlt;
    if (alt) candidates.add(remoteJidToDigits(alt));

    for (const c of candidates) {
      for (const variant of brazilianPhoneVariants(c)) {
        if (wanted.has(variant)) {
          // Confirma que há mensagens antes de retornar.
          const msgs = await findMessages(jid, { limit: 1 });
          if (msgs.length > 0) return jid;
        }
      }
    }
  }

  return null;
}
