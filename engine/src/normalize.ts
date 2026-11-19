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

// Extractors are stubs: real patterns come with the rule engine.
export function extractUrls(_text: string): string[] {
  return [];
}
export function extractEmails(_text: string): string[] {
  return [];
}
export function extractPhones(_text: string): string[] {
  return [];
}
export function extractCodes(_text: string): string[] {
  return [];
}
export function extractAmounts(_text: string): Amount[] {
  return [];
}
