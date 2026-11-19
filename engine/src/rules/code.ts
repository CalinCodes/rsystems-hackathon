import type { Hit } from '@ss/contracts';
import { GAP, NOT, firstHit, isDenied, makeHit, type MsgCtx, type Rule } from './util';

const NOUN = String.raw`(?:cod(?:ul|uri|urile)?|otp|token|parola unica)`;
// "confirma" only as a verb: "codul de confirmare" is a noun phrase and must not match.
const VERB = String.raw`(?:trimit\w*|spun\w*|comunic\w*|spui|dai|citesti|dati|da-mi|da-ne|furniz\w*|transmit\w*|citi(?:ti)?|redati|dicta(?:ti)?|confirma(?:ti)?)`;

const RE = new RegExp(
  `${NOT}\\b${VERB}\\b${GAP}\\b${NOUN}\\b` +
    `|\\b${NOUN}\\b${GAP}${NOT}\\b${VERB}\\b` +
    `|\\b(?:care (?:e|este)|ce)\\s+(?:\\w+\\s+)?${NOUN}\\b`,
  'g',
);

/**
 * Object-clitic requests: "mi-l trimiti", "mi-l poti trimite inapoi", "da-mi-l", "spune-mi-l".
 * They name no code themselves ("it" = the code), so they only count when a code/digits/SMS shows up nearby.
 * With a modal ("poti", "puteti", "ai putea") the verb is an infinitive; without one it is a 2nd-person form, which
 * is what separates "mi-l trimiti" (you send it to me) from "il trimit" (I will send it).
 */
const CLITIC = String.raw`(?:mi|ne)-(?:l|o|le)`;
const INFINITIVE = String.raw`(?:trimite|retrimite|spune|da|citi|dicta|transmite|arata|scrie)`;
const SECOND_PERSON = String.raw`(?:trimiti|trimiteti|retrimiti|retrimiteti|spui|spuneti|dai|dati|citesti|cititi|dictezi|dictati|transmiti|transmiteti|arati|aratati|scrii|scrieti)`;
const CLITIC_RE = new RegExp(
  `${NOT}\\b${CLITIC}\\s+(?:(?:poti|puteti|vrei|vreti|ai putea|ati putea)\\s+(?:sa\\s+)?(?:mi-l\\s+)?${INFINITIVE}|(?:sa\\s+)?${SECOND_PERSON})\\b` +
    `|\\b(?:da|dati|trimite|trimiteti|retrimite|spune|spuneti|citeste|cititi|scrie|scrieti)-(?:mi|ne)-(?:l|o|le)\\b`,
  'g',
);
const CODE_CONTEXT = /\b(?:cod\w*|cifr\w+|sms|otp|token|pin|parola unica)\b/;
const CONTEXT_BEFORE = 200; // roughly the current and previous sentence
const CONTEXT_AFTER = 80;
const PREVIOUS_MESSAGE_TAIL = 300;
const PREVIOUS_MESSAGES = 3;

function clitic(m: MsgCtx, previous: MsgCtx[]): Hit | null {
  // The code may have been mentioned a few turns back (by either side), not only in the message just before.
  const earlier = previous.map((p) => p.norm.slice(-PREVIOUS_MESSAGE_TAIL)).join(' ');
  for (const match of m.norm.matchAll(CLITIC_RE)) {
    const idx = match.index ?? 0;
    if (isDenied(m.norm, idx)) continue;
    const context = m.norm.slice(Math.max(0, idx - CONTEXT_BEFORE), idx + CONTEXT_AFTER) + ' ' + earlier;
    if (CODE_CONTEXT.test(context)) return makeHit('RF_CODE_REQUEST', m, idx, match[0].length);
  }
  return null;
}

export const codeRequest: Rule = (c) => {
  const out: Hit[] = [];
  c.msgs.forEach((m, i) => {
    if (m.from !== 'sender') return;
    const hit = firstHit('RF_CODE_REQUEST', m, RE) ?? clitic(m, c.msgs.slice(Math.max(0, i - PREVIOUS_MESSAGES), i));
    if (hit) out.push(hit);
  });
  return out;
};
