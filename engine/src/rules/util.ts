import type { FlagCode, Hit, Scenario } from '@ss/contracts';
import { canonicalize, normalizeText } from '../normalize';

export interface MsgCtx {
  n: number;
  from: 'sender' | 'reader';
  /** The message exactly as received. Security checks that canonicalisation could blind must read this. */
  orig: string;
  /** Canonical text (see canonicalize): invisible characters removed. */
  raw: string;
  /** Lowercased, diacritics stripped. Same length as raw, so indexes map back for evidence. */
  norm: string;
}

export interface RuleCtx {
  scenario: Scenario;
  msgs: MsgCtx[];
}

export type Rule = (c: RuleCtx) => Hit[];

export function buildCtx(s: Scenario): RuleCtx {
  // raw is the canonical text (not the original) so evidence slices stay aligned with norm even when
  // invisible characters were stripped out.
  const msgs = s.messages.map((m) => {
    const raw = canonicalize(m.text);
    return { n: m.n, from: m.from, orig: m.text, raw, norm: normalizeText(raw) };
  });
  return { scenario: s, msgs };
}

/**
 * Lookbehind that skips verbs already negated ("nu îl comunicați", "nu trimiteți").
 * WHY: genuine bank texts warn about exactly the things scammers ask for.
 */
// "nu trebuie sa platiti nimic", "nu e nevoie sa trimiteti codul" are reassurances, not requests.
export const NOT = String.raw`(?<!\bnu (?:(?:il|o|le|va|ne|mi|vi|ti|sa|trebuie|e|este|nevoie|mai|cerem|cer) )*)`;

/** Words between a verb and its object, never crossing a sentence end ("2.500" keeps its dot). */
export const GAP = String.raw`(?:[^.!?;\n]|\.(?=\d)){0,60}`;

/**
 * A denial only counts when it comes BEFORE the match, in the SAME clause (split on . ! ? ; newline and comma),
 * and within DENY_REACH characters of it, i.e. it plausibly governs that match.
 * WHY: a scammer can pad a message with "nu va cerem nimic" next to (or after) a real request to try to silence it.
 */
const DENY = /\bnu (?:(?:va|ne|vom|il|o|le) )*(?:cere\w*|cerem|solicit\w*|comunic\w*|divulg\w*|dezvalu\w*|furniz\w*|instal\w*)\b/g;
const DENY_REACH = 40;
const CONTRAST = /\b(?:decat|doar|dar|ci|insa|totusi|exceptand|cu exceptia|in afara de)\b/;

function clauseBounds(norm: string, index: number): { start: number; end: number } {
  const before = norm.slice(0, index);
  const start = Math.max(before.search(/[.!?;,\n][^.!?;,\n]*$/) + 1, 0);
  const end = norm.slice(index).search(/[!?;,\n]|\.(?!\d)/);
  return { start, end: end === -1 ? norm.length : index + end };
}

export function clauseAt(norm: string, index: number): string {
  const { start, end } = clauseBounds(norm, index);
  return norm.slice(start, end);
}

export function isDenied(norm: string, index: number): boolean {
  const { start, end } = clauseBounds(norm, index);
  for (const d of norm.slice(start, end).matchAll(DENY)) {
    const dStart = start + (d.index ?? 0);
    const dEnd = dStart + d[0].length;
    if (dStart > index || index - dEnd > DENY_REACH) continue;
    // "nu vă cerem nimic DAR instalați X": a contrast word between denial and match turns it back into a request.
    if (dEnd < index && CONTRAST.test(norm.slice(dEnd, index))) continue;
    return true;
  }
  return false;
}

export function makeHit(flag: FlagCode, m: MsgCtx, index: number, length: number): Hit {
  const evidence = m.raw.slice(index, index + length).trim().slice(0, 80);
  return { flag, msg: m.n, evidence, src: 'rule' };
}

/** First non-denied match of `re` (must be global) in the message, or null. */
export function firstHit(flag: FlagCode, m: MsgCtx, re: RegExp): Hit | null {
  for (const match of m.norm.matchAll(re)) {
    const idx = match.index ?? 0;
    if (isDenied(m.norm, idx)) continue;
    return makeHit(flag, m, idx, match[0].length);
  }
  return null;
}

/** Rules look at what the sender asks for; the reader's own words must never raise flags. */
export function perSenderMessage(c: RuleCtx, fn: (m: MsgCtx) => Hit | null): Hit[] {
  const out: Hit[] = [];
  for (const m of c.msgs) {
    if (m.from !== 'sender') continue;
    const h = fn(m);
    if (h) out.push(h);
  }
  return out;
}
