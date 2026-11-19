export interface TrustedPerson {
  name: string;
  phone: string;
}

/** The only storage the app has. It holds what the reader typed here, never anything from a message. */
export const TRUSTED_KEY = 'scam-shield.trusted';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Digits with an optional leading +, at least 6 of them. Spaces, dots and dashes are dropped. */
export function cleanPhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 15) return null;
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

export const telHref = (phone: string): string => `tel:${phone}`;

export function readTrusted(storage: StorageLike): TrustedPerson | null {
  try {
    const raw: unknown = JSON.parse(storage.getItem(TRUSTED_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return null;
    const { name, phone } = raw as Record<string, unknown>;
    if (typeof name !== 'string' || typeof phone !== 'string') return null;
    const clean = cleanPhone(phone);
    return name.trim() !== '' && clean !== null ? { name: name.trim(), phone: clean } : null;
  } catch {
    return null;
  }
}

/** Returns false when the input is not usable or the browser refuses to store (private mode). */
export function saveTrusted(storage: StorageLike, name: string, phone: string): boolean {
  const clean = cleanPhone(phone);
  if (name.trim() === '' || clean === null) return false;
  try {
    storage.setItem(TRUSTED_KEY, JSON.stringify({ name: name.trim(), phone: clean }));
    return true;
  } catch {
    return false;
  }
}

export function clearTrusted(storage: StorageLike): void {
  try {
    storage.removeItem(TRUSTED_KEY);
  } catch {
    // Nothing stored means nothing to delete.
  }
}

const memory = new Map<string, string>();
const inMemory: StorageLike = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

/**
 * The browser's storage, or a stand-in that lives until the page closes. Some browsers block storage
 * entirely and even touching `localStorage` throws, which must not break the screen.
 */
export function browserStorage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    return inMemory;
  }
}
