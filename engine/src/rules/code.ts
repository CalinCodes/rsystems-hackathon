import { extractCodes } from '../normalize';
import { GAP, NOT, perSenderMessage, firstHit, type Rule } from './util';

const NOUN = String.raw`(?:cod(?:ul|uri|urile)?|otp|token|parola unica)`;
// "confirma" only as a verb: "codul de confirmare" is a noun phrase and must not match.
const VERB = String.raw`(?:trimit\w*|spun\w*|comunic\w*|dati|da-mi|da-ne|furniz\w*|transmit\w*|citi(?:ti)?|redati|dicta(?:ti)?|confirma(?:ti)?)`;

const RE = new RegExp(
  `${NOT}\\b${VERB}\\b${GAP}\\b${NOUN}\\b` +
    `|\\b${NOUN}\\b${GAP}${NOT}\\b${VERB}\\b` +
    `|\\b(?:care (?:e|este)|ce)\\s+(?:\\w+\\s+)?${NOUN}\\b`,
  'g',
);

/** A sentence that itself contains the code is the sender *delivering* one, not asking for one. */
const deliversCode = (sentence: string): boolean => extractCodes(sentence).length > 0;

export const codeRequest: Rule = (c) =>
  perSenderMessage(c, (m) => firstHit('RF_CODE_REQUEST', m, RE, deliversCode));
