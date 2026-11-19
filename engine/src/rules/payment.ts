import { GAP, NOT, perSenderMessage, firstHit, type Rule } from './util';

// Imperative/request forms only: "platit"/"transferat" (past tense) are bank notifications, not demands.
const VERB = String.raw`(?:transfera|transferi|transferati|vira|virati|virezi|trimite|trimiti|trimiteti|platiti|platesti|achita|achiti|achitati|depune|depui|depuneti|incarca|incarci|incarcati|imprumuta|imprumuti)`;
const AMOUNT = String.raw`\d[\d.,\s]*\s*(?:lei|ron|eur|euro|usd|€|\$)`;
const OBJECT = String.raw`(?:${AMOUNT}|bani|suma|taxa|taxe|avans|comision|garantie|iban\w*|revolut|western union|moneygram|bitcoin|crypto|gift ?card|card cadou)`;

const RE = new RegExp(
  `${NOT}\\b${VERB}\\b${GAP}${OBJECT}|${OBJECT}${GAP}${NOT}\\b${VERB}\\b|\\bplata (?:taxei|sumei|comisionului|avansului)\\b`,
  'g',
);

export const paymentRequest: Rule = (c) => perSenderMessage(c, (m) => firstHit('RF_PAYMENT_REQUEST', m, RE));
