import { perSenderMessage, firstHit, type Rule } from './util';

const PATTERNS = [
  String.raw`\bmi-?am schimbat (?:numarul|telefonul)\b`,
  String.raw`\b(?:am|folosesc|scrie-mi pe) (?:un |noul )?(?:alt|nou)\w* numar\b`,
  String.raw`\b(?:noul|alt) (?:meu )?numar\b|\bnumar(?:ul)? nou\b`,
  String.raw`\b(?:telefon\w*|mobil\w*)(?: meu| vechi)? (?:mi )?(?:s-?a|mi-?a) (?:stricat|pierdut|furat|spart|udat|blocat)\b`,
  String.raw`\bnu mai am (?:telefonul|numarul) (?:vechi|meu)\b`,
  String.raw`\bsalveaz\w*(?:-l|-o)?[^.!?\n]{0,30}\bnumar\w*|\bnumar\w*[^.!?\n]{0,30}\bsalveaz\w*`,
];

const RE = new RegExp(PATTERNS.join('|'), 'g');

export const newNumber: Rule = (c) => perSenderMessage(c, (m) => firstHit('RF_NEW_NUMBER', m, RE));
