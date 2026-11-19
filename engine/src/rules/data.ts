import type { Hit, Scenario } from '@ss/contracts';
import { extractEmails, extractPhones, extractUrls } from '../normalize';
import { hostOf, isOfficialHost, ORGS } from './contact';
import { senderIsOrg } from './sender';
import { GAP, NOT, firstHit, isDenied, makeHit, perSenderMessage, type MsgCtx, type Rule } from './util';

const NOUN = String.raw`(?:cvv2?|cvc2?|cnp|pin|numar(?:ul)?\s+(?:de\s+)?(?:card(?:ului)?|cont(?:ului)?)|date(?:le)?\s+(?:de\s+)?(?:card(?:ului)?|bancare|personale|de\s+autentificare|de\s+acces|de\s+identificare|de\s+logare|contului)|data\s+expirarii|serie(?:a)?(?:\s+si\s+numar(?:ul)?)?\s+(?:de\s+)?(?:buletin|ci)|parola|datele\s+(?:dvs|tale|dumneavoastra)|credentiale\w*)`;
const VERB = String.raw`(?:trimit\w*|spun\w*|comunic\w*|dati|furniz\w*|transmit\w*|introdu\w*|completa(?:ti)?|actualiza(?:ti)?|confirma(?:ti)?|verifica(?:ti)?|dezvalui\w*|scrie(?:ti)?)`;

const RE = new RegExp(`${NOT}\\b${VERB}\\b${GAP}\\b${NOUN}\\b|\\b${NOUN}\\b${GAP}${NOT}\\b${VERB}\\b`, 'g');

/**
 * Asking the reader to log in to THEIR bank account is a data request ("intrati in contul de banca",
 * "logati-va in aplicatia bancii").
 *
 * It is NOT switched off by wording in the message: a phishing text can say "Banca Dunarea" as easily as a genuine one.
 * Only things the attacker cannot simply write into the text exempt it (see verifiedContext): a verified sender, or
 * links that all point at an official site.
 */
const ACCESS_VERB = String.raw`(?:intrati|intra|logati(?:-va)?|conectati(?:-va)?|autentificati(?:-va)?|accesati|deschideti)`;
const BANK_ACCOUNT_RE = new RegExp(
  String.raw`${NOT}\b${ACCESS_VERB}\b[^!?;\n]{0,20}\b(?:contul|cont|contului|aplicatia|aplicatiei)\b[^!?;\n]{0,15}\bbanc(?:a|ii|ar\w*)\b`,
  'g',
);

/**
 * At least one link, every link on an official catalog domain, AND no other way to reach someone: every e-mail address
 * and phone number in the message must be official too. Otherwise an official link next to "sunati la 0721 ..." would
 * switch the rule off while still sending the reader to the scammer.
 */
function onlyOfficialContacts(m: MsgCtx): boolean {
  const urls = extractUrls(m.raw);
  if (urls.length === 0) return false;
  const officialHost = (host: string): boolean => ORGS.some((o) => isOfficialHost(host, o.site));
  const emailsOk = extractEmails(m.raw).every((e) => officialHost(e.toLowerCase().slice(e.lastIndexOf('@') + 1)));
  const phonesOk = extractPhones(m.raw).every((p) => ORGS.some((o) => o.phones.includes(p)));
  return urls.every((u) => officialHost(hostOf(u))) && emailsOk && phonesOk;
}

/**
 * A verified sender exempts the request only if it is a verified BANK, or the organisation the message itself names.
 * A verified shop telling you to "log in to your bank account" is exactly the scam, so "verified as anything" is not
 * enough. (The catalog has no organisation type, so a bank is recognised by "banc" in its name.)
 */
function senderIsRelevantOrg(sender: Scenario['sender'], m: MsgCtx): boolean {
  return ORGS.some((o) => (o.nameRe.test(m.norm) || o.nameSrc.includes('banc')) && senderIsOrg(sender, o));
}

function bankAccountAccess(m: MsgCtx, sender: Scenario['sender']): Hit | null {
  for (const match of m.norm.matchAll(BANK_ACCOUNT_RE)) {
    const idx = match.index ?? 0;
    if (isDenied(m.norm, idx)) continue;
    if (senderIsRelevantOrg(sender, m) || onlyOfficialContacts(m)) continue;
    return makeHit('RF_DATA_REQUEST', m, idx, match[0].length);
  }
  return null;
}

export const dataRequest: Rule = (c) =>
  perSenderMessage(c, (m) => firstHit('RF_DATA_REQUEST', m, RE) ?? bankAccountAccess(m, c.scenario.sender));
