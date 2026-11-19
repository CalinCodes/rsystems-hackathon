import { GAP, NOT, perSenderMessage, firstHit, type Rule } from './util';

// Imperative/request forms only: "platit"/"transferat" (past tense) are bank notifications, not demands.
const VERB = String.raw`(?:transfera|transferi|transferati|vira|virati|virezi|trimite|trimiti|trimiteti|platiti|platesti|achita|achiti|achitati|depune|depui|depuneti|incarca|incarci|incarcati|imprumuta|imprumuti)`;
// Bounded ({0,14}) on purpose: an unbounded `[\d.,\s]*` is retried from every digit of a long number with no currency
// word after it, which is quadratic (99 s on 200k digits). Real amounts like "1.000.000,00 lei" fit in 15 characters.
const AMOUNT = String.raw`(?<![\d.,])\d[\d.,\s]{0,14}(?:lei|ron|eur|euro|usd|€|\$)`;
const OBJECT = String.raw`(?:${AMOUNT}|bani|suma|taxa|taxe|avans|comision|garantie|iban\w*|revolut|western union|moneygram|bitcoin|crypto|gift ?card|card cadou)`;

const RE = new RegExp(
  `${NOT}\\b${VERB}\\b${GAP}${OBJECT}|${OBJECT}${GAP}${NOT}\\b${VERB}\\b|\\bplata (?:taxei|sumei|comisionului|avansului)\\b`,
  'g',
);

export const paymentRequest: Rule = (c) => perSenderMessage(c, (m) => firstHit('RF_PAYMENT_REQUEST', m, RE));
