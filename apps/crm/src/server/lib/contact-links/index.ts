/**
 * Monta links de contato acionáveis a partir dos dados do lead.
 *
 * Nunca lança — cada builder retorna `null` quando o dado de entrada está
 * ausente/vazio, para que o caller decida se renderiza o link ou não.
 */

export function buildMailtoLink(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  if (trimmed.length === 0) return null;
  return `mailto:${trimmed}`;
}

export function buildWhatsAppLink(whatsapp: string | null | undefined): string | null {
  if (!whatsapp) return null;
  const digits = whatsapp.replace(/[^0-9]/g, '');
  if (digits.length === 0) return null;
  return `https://wa.me/${digits}`;
}

export function buildInstagramLink(handle: string | null | undefined): string | null {
  if (!handle) return null;
  const trimmed = handle.trim().replace(/^@/, '');
  if (trimmed.length === 0) return null;
  return `https://instagram.com/${trimmed}`;
}
