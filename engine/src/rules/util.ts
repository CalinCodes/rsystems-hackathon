import type { FlagCode, Hit, Scenario } from '@ss/contracts';
import { normalizeText } from '../normalize';

export interface MsgCtx {
  n: number;
  from: 'sender' | 'reader';
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
  const msgs = s.messages.map((m) => ({ n: m.n, from: m.from, raw: m.text, norm: normalizeText(m.text) }));
  return { scenario: s, msgs };
}

/**
 * Lookbehind that skips verbs already negated ("nu îl comunicați", "nu trimiteți").
 * WHY: genuine bank texts warn about exactly the things scammers ask for.
 */
export const NOT = String.raw`(?<!\bnu (?:(?:il|o|le|va|ne|mi|vi|ti|sa) )*)`;

/** Words between a verb and its object, never crossing a sentence end ("2.500" keeps its dot). */
export const GAP = String.raw`(?:[^.!?;\n]|\.(?=\d)){0,60}`;

/**
 * A denial only counts inside the SAME clause as the match (clauses split on . ! ? ; newline and comma).
 * WHY: a scammer can append "nu va cerem niciodata nimic" elsewhere in the text to try to silence a real request.
 */
const DENY = /\bnu (?:(?:va|ne|vom|il|o|le) )*(?:cere\w*|cerem|solicit\w*|comunic\w*|divulg\w*|dezvalu\w*|furniz\w*|instal\w*)\b/;

export function clauseAt(norm: string, index: number): string {
  const before = norm.slice(0, index);
  const start = Math.max(before.search(/[.!?;,\n][^.!?;,\n]*$/) + 1, 0);
  const rest = norm.slice(index);
  const end = rest.search(/[!?;,\n]|\.(?!\d)/);
  return norm.slice(start, end === -1 ? norm.length : index + end);
}

export function isDenied(norm: string, index: number): boolean {
  return DENY.test(clauseAt(norm, index));
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
