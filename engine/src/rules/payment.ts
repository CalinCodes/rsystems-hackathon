import { GAP, NOT, perSenderMessage, firstHit, type Rule } from './util';

// Imperative/request forms only: "platit"/"transferat" (past tense) are bank notifications, not demands.
const VERB = String.raw`(?:transfera|transferi|transferati|vira|virati|virezi|trimite|trimiti|trimiteti|platiti|platesti|achita|achiti|achitati|depune|depui|depuneti|incarca|incarci|incarcati|imprumuta|imprumuti)`;
// Unbounded but LINEAR. Each loop iteration eats exactly one digit (plus an optional separator), so there is only one
// way to split a number; the two lookbehinds stop a match starting mid-number (after a digit, or after "digit+space",
// which is how "1 850 lei" continues). Padding between number and currency ("100      lei", "100....lei") is any
// run of [.,\s], so it cannot be used to dodge the rule. A bounded `{0,14}` did dodge; `\d[\d.,\s]*` was quadratic.
const NUMBER = String.raw`(?<![\d.,])(?<!\d\s)\d(?:[.,\s]?\d)*`;
const AMOUNT = String.raw`${NUMBER}[.,\s]*(?:lei|ron|eur|euro|usd|€|\$)(?![a-z])|[€$]\s*${NUMBER}`;
const OBJECT = String.raw`(?:${AMOUNT}|bani|suma|taxa|taxe|avans|comision|garantie|iban\w*|revolut|western union|moneygram|bitcoin|crypto|gift ?card|card cadou)`;

const RE = new RegExp(
  `${NOT}\\b${VERB}\\b${GAP}${OBJECT}|${OBJECT}${GAP}${NOT}\\b${VERB}\\b|\\bplata (?:taxei|sumei|comisionului|avansului)\\b`,
  'g',
);

export const paymentRequest: Rule = (c) => perSenderMessage(c, (m) => firstHit('RF_PAYMENT_REQUEST', m, RE));
