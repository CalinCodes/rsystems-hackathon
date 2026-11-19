import type { Result } from '@ss/contracts';

/** What the reader is about to send that a scammer wants. */
export type GuardKind = 'code' | 'card' | 'cnp' | 'remote';

// WHY: every other check looks at what the scammer sends. This one looks at the reader's own reply, the last
// moment before the harm. It only runs in chats the engine already judged risky, so a normal "see you at 1830"
// to a friend is never stopped.

/** Digit runs, allowing one space or dash between digits ("482 913", "4111-1111-..."). Linear: no backtracking. */
const DIGIT_RUN = /\d(?:[ -]?\d)*/g;
/** A number followed by money is an amount, not a code ("1850 lei"). */
const MONEY_AFTER = /^\s*(?:de\s+)?(?:lei|ron|euro|eur|€|\$|usd)\b/i;
/** A number right after a money sign or a time colon is an amount or an hour, not a code. */
const MONEY_OR_TIME_BEFORE = /(?:€|\$|:)\s*$/;
const REMOTE_APP = /\b(?:anydesk|teamviewer|team viewer|quicksupport|quick support|rustdesk|supremo)\b/i;
const CNP_KEY = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

/** Card numbers carry a Luhn check digit, so a random 16-digit number almost never passes. */
export function isLuhn(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Romanian CNP: sex digit, valid month and day, then the official mod-11 control digit. */
export function isCnp(digits: string): boolean {
  if (!/^[1-9]\d{12}$/.test(digits)) return false;
  const month = Number(digits.slice(3, 5));
  const day = Number(digits.slice(5, 7));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const sum = CNP_KEY.reduce((acc, k, i) => acc + k * Number(digits[i]), 0);
  const control = sum % 11 === 10 ? 1 : sum % 11;
  return control === Number(digits[12]);
}

/** The most sensitive thing found in a draft reply, or null. Pure, so it is the same answer every time. */
export function findSensitive(draft: string): GuardKind | null {
  const text = draft.replace(/[\u00a0\u202f]/g, ' ');
  let code = false;
  let longRun = false;
  for (const m of text.matchAll(DIGIT_RUN)) {
    const digits = m[0].replace(/[ -]/g, '');
    if (isCnp(digits)) return 'cnp';
    if (isLuhn(digits)) return 'card';
    if (digits.length >= 6) longRun = true;
    const start = m.index ?? 0;
    const after = text.slice(start + m[0].length);
    const before = text.slice(0, start);
    const amountOrTime = MONEY_AFTER.test(after) || MONEY_OR_TIME_BEFORE.test(before) || after.startsWith(':');
    if (digits.length >= 4 && digits.length <= 8 && !amountOrTime) code = true;
  }
  // A remote-control app name next to a long number is the reader handing over access to the computer.
  if (longRun && REMOTE_APP.test(text)) return 'remote';
  return code ? 'code' : null;
}

/**
 * Stop the send only in a risky chat, and never twice for the same text: once the reader chose "send anyway"
 * for this exact draft, it is their decision.
 */
export function guardHit(draft: string, verdict: Result['verdict'], allowed: string): GuardKind | null {
  if (verdict === 'SAFE' || draft === allowed) return null;
  return findSensitive(draft);
}

const WHAT: Record<GuardKind, string> = {
  code: 'un cod',
  card: 'numărul cardului',
  cnp: 'CNP-ul',
  remote: 'datele de acces la calculatorul dumneavoastră',
};

/** Two short sentences: what is about to happen, then the engine's official-channel action for this chat. */
export function guardText(kind: GuardKind, action: string): string {
  return `Stați puțin! Sunteți pe cale să trimiteți ${WHAT[kind]} într-o conversație care pare o țeapă. ${action}`;
}
