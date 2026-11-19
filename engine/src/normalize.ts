/** Both comma-below and cedilla variants occur in real Romanian text, so map both. */
const DIACRITICS: Record<string, string> = {
  ă: 'a', â: 'a', î: 'i', ș: 's', ş: 's', ț: 't', ţ: 't',
};

export function stripDiacritics(text: string): string {
  return text.replace(/[ăâîșşțţ]/g, (c) => DIACRITICS[c] ?? c);
}

/** Lowercase first so capital Ă/Â/Î/Ș/Ț are covered by the lowercase map. */
export function normalizeText(text: string): string {
  return stripDiacritics(text.toLowerCase());
}

export interface Amount {
  value: number;
  currency: string;
  raw: string;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:ro|com|net|org|eu|info|xyz|top|click|link|app|online|site)\b(?:\/[^\s<>"']*)?/gi;
// Romanian numbers: +40 / 0040 / 0 prefix then 9 digits, with optional space/dot/dash separators.
const PHONE_RE = /(?<![\d+])(?:\+40|0040|0)[\s.-]?\d(?:[\s.-]?\d){8}(?!\d)/g;
const AMOUNT_RE = /(?<![\d.,])(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,(\d{1,2}))?\s*(lei|ron|eur|euro|usd|€|\$)(?![a-z])/gi;
const CODE_RE = /(?<![\d+.,-])\d{4,8}(?![\d]|[.,]\d)/g;

const trimTrailing = (s: string): string => s.replace(/[.,;:!?)\]]+$/, '');

export function extractEmails(text: string): string[] {
  return text.match(EMAIL_RE) ?? [];
}

export function extractUrls(text: string): string[] {
  // Blank out emails first, otherwise "x@bancadunarea.ro" would also read as a link.
  const noEmails = text.replace(EMAIL_RE, ' ');
  return (noEmails.match(URL_RE) ?? []).map(trimTrailing);
}

/** Returns numbers in national form (07xxxxxxxx) so the same number compares equal however it was typed. */
export function extractPhones(text: string): string[] {
  return (text.match(PHONE_RE) ?? []).map((raw) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('0040')) return '0' + digits.slice(4);
    if (raw.trimStart().startsWith('+40')) return '0' + digits.slice(2);
    return digits;
  });
}

export function extractAmounts(text: string): Amount[] {
  const out: Amount[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const whole = (m[1] ?? '').replace(/[.\s]/g, '');
    const value = Number(m[2] ? `${whole}.${m[2]}` : whole);
    const cur = (m[3] ?? '').toLowerCase();
    const currency = cur === 'ron' || cur === 'lei' ? 'RON' : cur === 'eur' || cur === 'euro' || cur === '€' ? 'EUR' : 'USD';
    out.push({ value, currency, raw: m[0] });
  }
  return out;
}

/** 4–8 digit standalone numbers (OTP-like). Phones and amounts are blanked first so they don't double-count. */
export function extractCodes(text: string): string[] {
  const cleaned = text.replace(PHONE_RE, ' ').replace(AMOUNT_RE, ' ');
  return cleaned.match(CODE_RE) ?? [];
}
