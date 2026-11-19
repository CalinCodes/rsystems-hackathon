/** Both comma-below and cedilla variants occur in real Romanian text, so map both. */
const DIACRITICS: Record<string, string> = {
  ă: 'a', â: 'a', î: 'i', ș: 's', ş: 's', ț: 't', ţ: 't',
};

export function stripDiacritics(text: string): string {
  return text.replace(/[ăâîșşțţ]/g, (c) => DIACRITICS[c] ?? c);
}

/**
 * Fold the tricks that make text look different to a regex than to a human or a browser:
 * NFKC (fullwidth letters/dots, compatibility forms), IDNA full stops (。 ｡) → ".", and removal of invisible
 * format characters (zero-width space, soft hyphen, joiners, bidi marks) and leftover combining marks.
 * WHY: "bancadunarea.ro​.evil.zzz" is the host bancadunarea.ro.evil.zzz in a browser, but a naive regex
 * would stop at the invisible character and report the official-looking prefix.
 * Real Romanian letters survive: NFKC recomposes a + breve into "ă" before stripdiacritics ever runs.
 */
export function canonicalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[。｡]/g, '.')
    .replace(/[\p{Cf}\p{M}]/gu, '');
}

/** Lowercase first so capital Ă/Â/Î/Ș/Ț are covered by the lowercase map. */
export function normalizeText(text: string): string {
  return stripDiacritics(canonicalize(text).toLowerCase());
}

export interface Amount {
  value: number;
  currency: string;
  raw: string;
}

// Unicode-aware like URL_RE: an ASCII-only pattern would skip "user@bаncadunarea.ro" (Cyrillic а) entirely, and
// URL_RE refuses to start a host right after "@", so neither extractor would see it.
// Leading lookbehind: start only at the beginning of a local-part run, never mid-run (avoids quadratic rescans).
const EMAIL_RE = /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*\.\p{L}{2,}/giu;
/**
 * Bare hosts are matched as the WHOLE dotted token, ending only at a real boundary. A TLD allowlist inside the regex
 * would stop at "bancadunarea.ro" in "bancadunarea.ro.evil.zzz" and report an official-looking host.
 */
const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s<>"']+|(?<![\p{L}\p{N}_@.-])[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+(?![\p{L}\p{N}_-]|\.[\p{L}\p{N}_])(?:\/[^\s<>"']*)?/giu;

const KNOWN_TLDS = new Set(
  'ro com net org eu info xyz top click link app online site shop store live icu vip club biz cc me co io ly gy gd gl example'.split(' '),
);

/** Filters prose like "2.500" or "ok.sunati": a bare token must end in a known TLD, or have 3+ labels ending in letters. */
function looksLikeUrl(token: string): boolean {
  if (/^(?:https?:\/\/|www\.)/i.test(token)) return true;
  const labels = (token.split('/')[0] ?? '').toLowerCase().split('.');
  const tld = labels[labels.length - 1] ?? '';
  return KNOWN_TLDS.has(tld) || (labels.length >= 3 && /^\p{L}{2,24}$/u.test(tld));
}
// Romanian numbers: +40 / 0040 / 0 prefix then 9 digits, with optional space/dot/dash separators.
const PHONE_RE = /(?<![\d+])(?:\+40|0040|0)[\s.-]?\d(?:[\s.-]?\d){8}(?!\d)/g;
const AMOUNT_RE = /(?<![\d.,])(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,(\d{1,2}))?\s*(lei|ron|eur|euro|usd|€|\$)(?![a-z])/gi;
const CODE_RE = /(?<![\d+.,-])\d{4,8}(?![\d]|[.,]\d)/g;

const trimTrailing = (s: string): string => s.replace(/[.,;:!?)\]]+$/, '');

export function extractEmails(text: string): string[] {
  return canonicalize(text).match(EMAIL_RE) ?? [];
}

const SCHEME_URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

// "user@host/path" without a scheme: an email followed by a path is really a link with userinfo.
const EMAIL_PATH_RE = new RegExp(String.raw`${EMAIL_RE.source}[/?#][^\s<>"']*`, 'giu');

const blank = (text: string, re: RegExp): string => text.replace(re, (m) => ' '.repeat(m.length));

/**
 * Scheme-prefixed URLs are taken BEFORE emails are blanked: "https://bancadunarea.ro@evil.xyz/x"
 * contains an email-looking span, and blanking it first would hide the whole link.
 * Length-preserving blanking keeps match indexes so results stay in reading order.
 */
export function extractUrls(raw: string): string[] {
  const text = canonicalize(raw);
  const found: { index: number; url: string }[] = [];
  for (const m of text.matchAll(SCHEME_URL_RE)) found.push({ index: m.index ?? 0, url: m[0] });
  const noScheme = blank(text, SCHEME_URL_RE);
  for (const m of noScheme.matchAll(EMAIL_PATH_RE)) found.push({ index: m.index ?? 0, url: m[0] });
  const rest = blank(blank(noScheme, EMAIL_PATH_RE), EMAIL_RE);
  for (const m of rest.matchAll(URL_RE)) if (looksLikeUrl(m[0])) found.push({ index: m.index ?? 0, url: m[0] });
  return found.sort((a, b) => a.index - b.index).map((f) => trimTrailing(f.url));
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
