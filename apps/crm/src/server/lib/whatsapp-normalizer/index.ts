/**
 * Normalizes heterogeneous phone-number inputs to E.164.
 *
 * Handles the format zoo observed in the legacy Respondi CSV:
 *   "55 11999834487"      Brazilian with country code + space
 *   "5519996524949"       Brazilian, no separators, no +
 *   "351 911990810"       Portugal
 *   "1 6193194244"        US
 *   "(11) 99999-9999"     punctuation
 *   "9,71971E+15"         Excel coerced to scientific notation (unrecoverable)
 *
 * Returns { ok: true, e164 } or { ok: false, reason }.
 * Never throws.
 */

export type NormalizationError =
  | 'empty'
  | 'scientific_notation'
  | 'too_short'
  | 'too_long'
  | 'invalid';

export type NormalizationResult =
  | { ok: true; e164: string }
  | { ok: false; reason: NormalizationError };

const E164_MIN_DIGITS = 10;
const E164_MAX_DIGITS = 15;
const BR_LANDLINE_LENGTH = 10;
const BR_MOBILE_LENGTH = 11;

export function normalizeWhatsapp(input: string | null | undefined): NormalizationResult {
  if (input == null) return { ok: false, reason: 'empty' };

  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };

  // Excel coerces long numbers to scientific notation (e.g., "9,71971E+15").
  // Recovering original digits is unsafe; flag for manual review.
  if (/\d[eE][+-]?\d/.test(trimmed)) {
    return { ok: false, reason: 'scientific_notation' };
  }

  // Detect "CC NUMBER" format before stripping non-digits.
  // Brazilian DDDs are always 2 digits, so:
  //   - 1-digit prefix before a space = always a country code (e.g., US "1")
  //   - 3-digit prefix before a space = always a country code (e.g., Portugal "351")
  //   - 2-digit prefix = country code only if total digits > 11 (otherwise it's a BR DDD)
  const ccSpaceMatch = trimmed.match(/^(\d{1,3})\s[\d\s\-()+]+$/);
  if (ccSpaceMatch) {
    const ccStr = ccSpaceMatch[1]!;
    const allDigits = trimmed.replace(/\D/g, '');
    const isSingleDigitCC = ccStr.length === 1;
    const isThreeDigitCC = ccStr.length === 3;
    const isTwoDigitCC = ccStr.length === 2 && allDigits.length > 11;
    if (isSingleDigitCC || isThreeDigitCC || isTwoDigitCC) {
      if (allDigits.length < E164_MIN_DIGITS) return { ok: false, reason: 'too_short' };
      if (allDigits.length > E164_MAX_DIGITS) return { ok: false, reason: 'too_long' };
      return { ok: true, e164: `+${allDigits}` };
    }
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return { ok: false, reason: 'empty' };
  if (digits.length < E164_MIN_DIGITS) return { ok: false, reason: 'too_short' };
  if (digits.length > E164_MAX_DIGITS) return { ok: false, reason: 'too_long' };

  // 10 or 11 digits with no country code → assume Brazil.
  if (digits.length === BR_LANDLINE_LENGTH || digits.length === BR_MOBILE_LENGTH) {
    return { ok: true, e164: `+55${digits}` };
  }

  // Already has country code; just prepend +.
  return { ok: true, e164: `+${digits}` };
}

/** Returns digits-only string from any input (no validation). Useful for search. */
export function whatsappDigitsOnly(input: string | null | undefined): string {
  if (input == null) return '';
  return input.replace(/\D/g, '');
}
