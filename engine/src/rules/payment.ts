import type { Hit } from '@ss/contracts';
import { NOT, clauseAt, isDenied, makeHit, perSenderMessage, type MsgCtx, type Rule } from './util';

/**
 * Payment requests. Verbs are request forms only: "platit"/"transferat" (past tense) are bank notifications.
 *
 * DESIGN: no regex ever has to match "number ... currency" as one pattern. A number regex with optional separators is
 * either quadratic ("1 1 1 1 ...") or, once guarded with lookbehinds, bypassable (".5 100 lei" hides the amount).
 * Instead we find the currency WORD (a fixed token) and walk backwards by hand over separators to a digit: linear,
 * and no padding ("100      lei", "100....lei") or prepended junk can dodge it.
 */
const VERB = String.raw`(?:transfera|transferi|transferati|vira|virati|virezi|vireaza|trimite|trimiti|trimiteti|platiti|platesti|plateste|achita|achiti|achitati|depune|depui|depuneti|incarca|incarci|incarcati|imprumuta|imprumuti|retrage|retrageti|scoate|scoateti|da-mi|dati-mi|muta|muti|mutati)`;
const VERB_RE = new RegExp(`${NOT}\\b${VERB}\\b`, 'g');

// Requests that are a payment ask by themselves: "poti sa-mi faci un transfer", "am nevoie de bani".
const STANDALONE_RE = new RegExp(
  [
    String.raw`${NOT}\b(?:fa|faci|faceti|efectueaza|efectuati|efectuezi|realizeaza|realizati|realizezi)\s+(?:un\s+|o\s+)?(?:transfer|virament|plata)\w*`,
    String.raw`\b(?:am nevoie|imi trebuie|imi mai trebuie|trebuie|necesar\w*|cer|solicit|vreau)\s+(?:urgent\s+)?(?:de\s+)?(?:un\s+|o\s+)?(?:transfer|virament|plata|bani|banii|suma)\b`,
    String.raw`\bplata (?:taxei|sumei|comisionului|avansului)\b`,
    // "imi trebuie 1.500 euro", "am nevoie de 900 lei": a need stated as an amount.
    String.raw`\b(?:am nevoie|imi trebuie|ne trebuie|avem nevoie)\s+(?:de\s+)?\d`,
    // "fee de procesare 200 lei platibil in 24h", "taxa e de achitat azi"
    String.raw`\bplatibil\w*|\bde (?:achitat|platit)\b`,
    // "se cere o garantie de 150 lei", "este necesar un avans"
    String.raw`\b(?:se cere|cerem|cereti|percepem|e necesar\w*|este necesar\w*)\b[^.!?\n]{0,30}\b(?:garanti\w*|tax\w*|avans\w*|depozit\w*|depunere|fee|comision\w*)\b`,
  ].join('|'),
  'g',
);

const WORD_OBJECT = /\b(?:bani|banii|suma|sume|taxa|taxe|avans|avansul|comision|garantie|iban\w*|revolut|western union|moneygram|bitcoin|crypto|gift ?card|card cadou|economii\w*|depozit\w*|transfer|cont(?:ul)? (?:sigur|de protectie|de garantie))\b/;
const CURRENCY = /(?<![a-z])(?:lei|ron|euro|eur|usd|dolari|dolar|lire|gbp|chf)(?![a-z])|[€$]/g;
// "transfer de 500 lei" is a demand, but "transferul de 500 lei a fost efectuat" is a bank notice.
const NOTICE = /\b(?:efectuat\w*|primit\w*|confirmat\w*|reusit\w*|autorizat\w*|finalizat\w*|procesat\w*|aprobat\w*|incasat\w*|realizat\w*)\b/;
const WINDOW = 60;

/**
 * A "." ends a sentence only when whitespace (or the end) follows it AND it does not follow a digit or another dot.
 * So "2.500" and padding like "100....lei" or "100... lei" stay inside one sentence.
 */
function endsSentence(w: string, i: number): boolean {
  const ch = w[i];
  if (ch === '!' || ch === '?' || ch === ';' || ch === '\n') return true;
  if (ch !== '.') return false;
  const next = w[i + 1];
  const prev = w[i - 1];
  const nextIsBreak = next === undefined || /\s/.test(next);
  const prevIsPadding = prev !== undefined && (prev === '.' || (prev >= '0' && prev <= '9'));
  return nextIsBreak && !prevIsPadding;
}

/** Cut at the first sentence end. */
function untilSentenceEnd(w: string): string {
  for (let i = 0; i < w.length; i++) if (endsSentence(w, i)) return w.slice(0, i);
  return w;
}

/** Keep only the tail after the last sentence end. */
function sinceSentenceStart(w: string): string {
  for (let i = w.length - 1; i >= 0; i--) if (endsSentence(w, i)) return w.slice(i + 1);
  return w;
}

const isSeparator = (ch: string): boolean => ch === '.' || ch === ',' || /\s/.test(ch);

/** True when a currency word/symbol has a digit before it, allowing any run of separators in between. */
function amountPresent(w: string): boolean {
  if (/[€$]\s*\d/.test(w)) return true;
  for (const m of w.matchAll(CURRENCY)) {
    let i = (m.index ?? 0) - 1;
    while (i >= 0 && isSeparator(w[i] ?? '')) i--;
    const ch = w[i];
    if (i >= 0 && ch !== undefined && ch >= '0' && ch <= '9') return true;
  }
  return false;
}

const hasObject = (w: string): boolean => WORD_OBJECT.test(w) || amountPresent(w);

function verbWithObject(m: MsgCtx): Hit | null {
  for (const v of m.norm.matchAll(VERB_RE)) {
    const start = v.index ?? 0;
    const end = start + v[0].length;
    if (isDenied(m.norm, start)) continue;
    const after = untilSentenceEnd(m.norm.slice(end, end + WINDOW));
    const before = sinceSentenceStart(m.norm.slice(Math.max(0, start - WINDOW), start));
    if (hasObject(after) || hasObject(before)) return makeHit('RF_PAYMENT_REQUEST', m, start, v[0].length);
  }
  return null;
}

function standalone(m: MsgCtx): Hit | null {
  for (const s of m.norm.matchAll(STANDALONE_RE)) {
    const start = s.index ?? 0;
    if (!isDenied(m.norm, start)) return makeHit('RF_PAYMENT_REQUEST', m, start, s[0].length);
  }
  return null;
}

function nounWithAmount(m: MsgCtx): Hit | null {
  for (const t of m.norm.matchAll(/\b(?:transfer|virament)\w*/g)) {
    const start = t.index ?? 0;
    const end = start + t[0].length;
    if (isDenied(m.norm, start) || NOTICE.test(clauseAt(m.norm, start))) continue;
    if (amountPresent(untilSentenceEnd(m.norm.slice(end, end + 40)))) return makeHit('RF_PAYMENT_REQUEST', m, start, t[0].length);
  }
  return null;
}

export const paymentRequest: Rule = (c) => perSenderMessage(c, (m) => verbWithObject(m) ?? standalone(m) ?? nounWithAmount(m));
